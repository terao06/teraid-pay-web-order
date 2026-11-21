export function isOrderReceipt(receipt) {
  return Number.isSafeInteger(receipt?.menu_order_id)
    && receipt.menu_order_id > 0
    && typeof receipt.total_amount === 'string'
    && /^-?\d{1,14}\.\d{6}$/.test(receipt.total_amount)
    && typeof receipt.token_symbol === 'string'
    && receipt.token_symbol.trim().length > 0
}
