import { isOrderAmount } from './orderDetails.js'

export function isOrderReceipt(receipt) {
  return Number.isSafeInteger(receipt?.menu_order_id)
    && receipt.menu_order_id > 0
    && isOrderAmount(receipt.total_amount)
    && typeof receipt.token_symbol === 'string'
    && receipt.token_symbol.trim().length > 0
}
