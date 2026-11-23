import { isCheckoutState, isId } from '../checkout/checkoutState.js'

const KEY_PREFIX = 'teraid-pay-visit-session:'
const REQUEST_ID_LENGTH = 64

export function visitSessionStorageKey(deviceUuid) {
  return KEY_PREFIX + deviceUuid
}

export class VisitSessionStorageError extends Error {
  constructor() {
    super('Visit session storage unavailable')
    this.name = 'VisitSessionStorageError'
  }
}

function withStorage(deviceUuid, work) {
  try {
    return work(globalThis.localStorage, visitSessionStorageKey(deviceUuid))
  } catch {
    throw new VisitSessionStorageError()
  }
}

function restoreCheckout(checkout, paymentMode) {
  if (checkout === undefined) return undefined
  if (!checkout || typeof checkout !== 'object') throw new VisitSessionStorageError()
  const { orderId, ...state } = checkout
  if (orderId === undefined) return state
  if (paymentMode === 'combined' && orderId === null) return state
  if (paymentMode !== 'per_order') throw new VisitSessionStorageError()
  if (orderId === null && ['complete', 'completion_blocked'].includes(state.phase)) return state
  if (!isId(orderId)) throw new VisitSessionStorageError()

  // Resume any payment that may have reached the API with its original checkout ID and key.
  if (['create', 'review', 'failed'].includes(state.phase)) return undefined
  if (state.summary?.orders?.length !== 1 || state.summary.orders[0]?.menu_order_id !== orderId) {
    throw new VisitSessionStorageError()
  }
  if (state.phase === 'sending') state.legacyPayment = true
  if (state.phase === 'paid') state.phase = 'complete'
  return state
}

export const visitSessionStore = {
  load(deviceUuid) {
    return withStorage(deviceUuid, (storage, key) => {
      const value = storage.getItem(key)
      if (value === null) return null

      const { paymentMode, checkout, ...record } = JSON.parse(value)
      const hasSessionId = record.visitSessionId !== undefined
      if (
        typeof record.requestId !== 'string'
        || !record.requestId.trim()
        || record.requestId.length > REQUEST_ID_LENGTH
        || (paymentMode !== undefined && !['combined', 'per_order'].includes(paymentMode)
          && !(hasSessionId && paymentMode === null))
        || (hasSessionId && !isId(record.visitSessionId))
        || (checkout !== undefined && (!hasSessionId || paymentMode === null))
        || (record.paidOrderIds !== undefined && (!hasSessionId || !Array.isArray(record.paidOrderIds)
          || !record.paidOrderIds.every(isId)))
      ) {
        throw new VisitSessionStorageError()
      }
      const restoredCheckout = restoreCheckout(checkout, paymentMode)
      if (restoredCheckout !== undefined) {
        if (!isCheckoutState(restoredCheckout)) throw new VisitSessionStorageError()
        record.checkout = restoredCheckout
      }
      return record
    })
  },

  save(deviceUuid, record) {
    withStorage(deviceUuid, (storage, key) => storage.setItem(key, JSON.stringify(record)))
  },

  clear(deviceUuid) {
    withStorage(deviceUuid, (storage, key) => storage.removeItem(key))
  },
}
