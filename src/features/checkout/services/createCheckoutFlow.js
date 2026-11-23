import { ApiError } from '../../../components/api/apiClient.js'
import { createAuthenticatedDeviceRequest } from '../../device-auth/services/createAuthenticatedDeviceRequest.js'

function sameCheckout(current, expected) {
  return current?.phase === expected?.phase
    && current?.legacyPayment === expected?.legacyPayment
    && current?.tokenSymbol === expected?.tokenSymbol
    && current?.summary?.checkout_id === expected?.summary?.checkout_id
    && current?.key === expected?.key
    && current?.paymentId === expected?.paymentId
}

export function createCheckoutFlow({
  auth, storage, withLock, generateKey, createCheckout, startFacePayment, verifyPayment,
  completeVisitSession, clearCart,
}) {
  const authenticate = createAuthenticatedDeviceRequest(auth)

  function update(deviceUuid, visitSessionId, expected, work) {
    return withLock(deviceUuid, async () => {
      const record = storage.load(deviceUuid)
      if (record?.visitSessionId !== visitSessionId || !sameCheckout(record.checkout, expected)) return

      function save(checkout, changes) {
        const updated = { ...record, ...changes }
        if (checkout) updated.checkout = checkout
        else delete updated.checkout
        storage.save(deviceUuid, updated)
      }

      return work(record, save, (operation) => authenticate(deviceUuid, operation))
    })
  }

  return {
    order(deviceUuid, visitSessionId, expected, confirm) {
      return update(deviceUuid, visitSessionId, expected, async (_record, save) => {
        if (expected && expected.phase !== 'deferred') return
        if (await confirm()) save({ phase: 'create' })
      })
    },

    begin(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, (_record, save) => {
        if (expected?.phase === 'payment_deferred') return save({ ...expected, phase: 'sending' })
        if (expected?.phase === 'deferred') return save({ ...expected, phase: 'create' })
        if (expected) return
        save({ phase: 'create' })
      })
    },

    create(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, async (_record, save, request) => {
        if (expected?.phase !== 'create') return
        const summary = await request((token) => createCheckout(visitSessionId, token))
        save({ phase: 'review', summary })
      })
    },

    pay(deviceUuid, visitSessionId, expected, content) {
      return update(deviceUuid, visitSessionId, expected, async (_record, save, request) => {
        if (!['review', 'sending'].includes(expected?.phase)) return
        const { summary } = expected
        const retrying = expected.phase === 'sending'
        const key = retrying ? expected.key : generateKey()
        if (!retrying) save({ phase: 'sending', summary, key })

        let payment
        try {
          payment = await request((token) => startFacePayment(summary.checkout_id, key, content, token))
        } catch (error) {
          // An earlier request may still be running after a timeout. Keep its key on retries.
          if (error instanceof ApiError) {
            if (error.status === 409 && (!retrying || expected.legacyPayment)) {
              save({ phase: 'create' })
            } else if (!retrying && [400, 401, 404, 422].includes(error.status)) {
              save({ phase: 'review', summary })
            }
          }
          throw error
        }

        save({ phase: 'verify', summary, paymentId: payment.payment_request_id })
      })
    },

    verify(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, async (record, save, request) => {
        if (expected?.phase !== 'verify') return
        const { summary, paymentId } = expected
        const result = await request((token) => verifyPayment(summary.checkout_id, paymentId, token))
        if (result.status === 'confirming') return
        if (result.status !== 'paid') return save({ phase: 'failed', summary })

        const paidOrderIds = [...new Set([
          ...(record.paidOrderIds ?? []), ...summary.orders.map((order) => order.menu_order_id),
        ])]
        const phase = result.visit_session_status === 'closed' ? 'complete' : 'paid'
        save({ phase, summary }, { paidOrderIds })
      })
    },

    retryCheckout(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, (_record, save) => {
        if (expected?.phase === 'failed') save({ phase: 'create' })
      })
    },

    retryCompletion(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, (_record, save) => {
        if (expected?.phase === 'completion_blocked') {
          save({ ...expected, phase: 'complete' })
        }
      })
    },

    continueOrdering(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, (_record, save) => {
        if (expected?.phase === 'paid') save(undefined)
      })
    },

    finish(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, (_record, save) => {
        if (!expected || expected.phase === 'paid') save({ ...expected, phase: 'complete' })
      })
    },

    complete(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, async (_record, save, request) => {
        if (expected?.phase !== 'complete') return
        try {
          await request((token) => completeVisitSession(visitSessionId, token))
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            save({ ...expected, phase: 'completion_blocked' })
          }
          throw error
        }
        clearCart(deviceUuid, visitSessionId)
        storage.clear(deviceUuid)
        return true
      })
    },

    backToMenu(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, (_record, save) => {
        if (expected?.phase === 'completion_blocked') save(undefined)
      })
    },
  }
}
