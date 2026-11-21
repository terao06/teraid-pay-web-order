const phases = ['create', 'review', 'sending', 'verify', 'failed', 'paid', 'complete', 'completion_blocked']
const paymentStatuses = ['confirming', 'paid', 'tx_failed', 'verify_failed', 'canceled', 'error']
const sessionStatuses = ['active', 'checkout_processing', 'closed']

export function isId(value) {
  return Number.isSafeInteger(value) && value > 0
}

function isAmount(value) {
  return typeof value === 'string' && /^-?\d{1,14}\.\d{6}$/.test(value)
}

function isOption(option) {
  return typeof option?.option_group_name === 'string'
    && typeof option.option_name === 'string'
    && isAmount(option.additional_price)
    && isId(option.option_quantity)
}

function isItem(item) {
  return typeof item?.menu_item_name === 'string'
    && isId(item.quantity)
    && isAmount(item.unit_price)
    && isAmount(item.line_amount)
    && Array.isArray(item.options)
    && item.options.every(isOption)
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
      && isAmount(order.total_amount)
      && Array.isArray(order.items)
      && order.items.every(isItem))
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

export function isCheckoutState(checkout, paymentMode) {
  if (!phases.includes(checkout?.phase)) return false
  const finishing = ['complete', 'completion_blocked'].includes(checkout.phase)
  if (finishing && checkout.summary === undefined) {
    return paymentMode === 'per_order' && checkout.orderId === null
  }
  if (paymentMode === 'per_order' ? !isId(checkout.orderId) : checkout.orderId !== null) return false
  if (checkout.phase === 'create') return true
  if (!isCheckoutSummary(checkout.summary)) return false
  if (checkout.orderId !== null && (checkout.summary.orders.length !== 1
    || checkout.summary.orders[0].menu_order_id !== checkout.orderId)) return false
  if (checkout.phase === 'sending') {
    return typeof checkout.key === 'string' && Boolean(checkout.key.trim()) && checkout.key.length <= 64
  }
  return checkout.phase !== 'verify' || isId(checkout.paymentId)
}
