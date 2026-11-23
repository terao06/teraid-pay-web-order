import { isOrderAmount, isOrderItem } from '../order/orderDetails.js'

const phases = [
  'create', 'review', 'sending', 'verify', 'failed', 'paid', 'complete', 'completion_blocked', 'deferred', 'payment_deferred',
]
const paymentStatuses = ['confirming', 'paid', 'tx_failed', 'verify_failed', 'canceled', 'error']
const sessionStatuses = ['active', 'checkout_processing', 'closed']

export function isCheckoutDeferred(phase) {
  return ['deferred', 'payment_deferred'].includes(phase)
}

export function isId(value) {
  return Number.isSafeInteger(value) && value > 0
}

export function isCheckoutSummary(summary) {
  return isId(summary?.checkout_id)
    && typeof summary.total_amount === 'string'
    && /^-?\d{1,22}\.\d{6}$/.test(summary.total_amount)
    && typeof summary.token_symbol === 'string'
    && Boolean(summary.token_symbol.trim())
    && Array.isArray(summary.orders)
    && summary.orders.length > 0
    && summary.orders.every((order) => isId(order?.menu_order_id)
      && isOrderAmount(order.total_amount)
      && Array.isArray(order.items)
      && order.items.every(isOrderItem))
}

export function isPaymentStarted(data) {
  return isId(data?.payment_request_id)
    && ['requested', 'submitted', ...paymentStatuses].includes(data.status)
}

export function isPaymentResult(data, paymentId) {
  return data?.payment_request_id === paymentId
    && paymentStatuses.includes(data.status)
    && sessionStatuses.includes(data.visit_session_status)
}

export function isCheckoutState(checkout) {
  if (!phases.includes(checkout?.phase)) return false
  const hasPendingPayment = ['sending', 'payment_deferred'].includes(checkout.phase)
  if (checkout.legacyPayment !== undefined
    && !(hasPendingPayment && checkout.legacyPayment === true)) return false
  if (['create', 'deferred'].includes(checkout.phase)) {
    return checkout.tokenSymbol === undefined
      || (typeof checkout.tokenSymbol === 'string' && Boolean(checkout.tokenSymbol.trim()))
  }
  if (['complete', 'completion_blocked'].includes(checkout.phase) && checkout.summary === undefined) return true
  if (!isCheckoutSummary(checkout.summary)) return false
  if (hasPendingPayment) {
    return typeof checkout.key === 'string' && Boolean(checkout.key.trim()) && checkout.key.length <= 64
  }
  return checkout.phase !== 'verify' || isId(checkout.paymentId)
}
