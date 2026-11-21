export const PAYMENT_MODE_LABELS = {
  combined: '一括決済',
  per_order: '注文ごとの決済',
}

export function isPaymentMode(value) {
  return typeof value === 'string' && Object.hasOwn(PAYMENT_MODE_LABELS, value)
}
