import { ApiError } from '../../../components/api/apiClient.js'
import { createAuthenticatedDeviceRequest } from '../../device-auth/services/createAuthenticatedDeviceRequest.js'
import { isId } from '../checkoutState.js'

function sameCheckout(current, expected) {
  return current?.phase === expected?.phase
    && current?.orderId === expected?.orderId
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
    order(deviceUuid, visitSessionId, expected, { paymentMode, confirm }) {
      return update(deviceUuid, visitSessionId, expected, async (record, save) => {
        if (expected || record.paymentMode !== paymentMode) return
        const orderId = await confirm()
        if (paymentMode === 'per_order' && isId(orderId) && !record.paidOrderIds?.includes(orderId)) {
          save({ phase: 'create', orderId })
        }
      })
    },

    begin(deviceUuid, visitSessionId, expected, orderId) {
      return update(deviceUuid, visitSessionId, expected, (record, save) => {
        if (expected || (orderId === null && record.paymentMode !== 'combined')) return
        if (orderId !== null && (record.paymentMode !== 'per_order' || !isId(orderId)
          || record.paidOrderIds?.includes(orderId))) return
        save({ phase: 'create', orderId })
      })
    },

    create(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, async (record, save, request) => {
        if (expected?.phase !== 'create') return
        const { orderId } = expected
        const summary = await request((token) => createCheckout(visitSessionId, orderId, token))
        save({ phase: 'review', orderId, summary })
      })
    },

    pay(deviceUuid, visitSessionId, expected, content) {
      return update(deviceUuid, visitSessionId, expected, async (record, save, request) => {
        if (!['review', 'sending'].includes(expected?.phase)) return
        const { orderId, summary } = expected
        const retrying = expected.phase === 'sending'
        const key = retrying ? expected.key : generateKey()
        if (!retrying) save({ phase: 'sending', orderId, summary, key })

        let payment
        try {
          payment = await request((token) => startFacePayment(summary.checkout_id, key, content, token))
        } catch (error) {
          // An earlier request may still be running after a timeout. Keep its key on retries.
          if (!retrying && error instanceof ApiError) {
            if (error.status === 409) save({ phase: 'create', orderId })
            else if ([400, 401, 404, 422].includes(error.status)) save({ phase: 'review', orderId, summary })
          }
          throw error
        }

        save({ phase: 'verify', orderId, summary, paymentId: payment.payment_request_id })
      })
    },

    verify(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, async (record, save, request) => {
        if (expected?.phase !== 'verify') return
        const { orderId, summary, paymentId } = expected
        const result = await request((token) => verifyPayment(summary.checkout_id, paymentId, token))
        if (result.status === 'confirming') return
        if (result.status !== 'paid') return save({ phase: 'failed', orderId, summary })

        const paidOrderIds = [...new Set([
          ...(record.paidOrderIds ?? []), ...summary.orders.map((order) => order.menu_order_id),
        ])]
        const phase = record.paymentMode === 'combined' || result.visit_session_status === 'closed' ? 'complete' : 'paid'
        save({ phase, orderId, summary }, { paidOrderIds })
      })
    },

    retryCheckout(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, (record, save) => {
        if (expected?.phase === 'failed') save({ phase: 'create', orderId: expected.orderId })
      })
    },

    end(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, (record, save) => {
        if (expected?.phase === 'completion_blocked') {
          save({ ...expected, phase: 'complete' })
        } else if (record.paymentMode === 'per_order' && (!expected || expected.phase === 'paid')) {
          save({ ...(expected ?? { orderId: null }), phase: 'complete' })
        }
      })
    },

    complete(deviceUuid, visitSessionId, expected) {
      return update(deviceUuid, visitSessionId, expected, async (record, save, request) => {
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
      return update(deviceUuid, visitSessionId, expected, (record, save) => {
        if (['paid', 'completion_blocked'].includes(expected?.phase)
          || (record.paymentMode === 'combined' && ['create', 'review', 'failed'].includes(expected?.phase))) {
          save(undefined)
        }
      })
    },
  }
}
