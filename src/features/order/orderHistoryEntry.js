import { isOrderItem } from './orderDetails.js'
import { isOrderReceipt } from './orderReceipt.js'

export const ORDER_STATUS_PAID = 3
export const ORDER_STATUS_CANCELED = 5

export const ORDER_STATUS_LABELS = {
  1: '未払い',
  2: '決済処理中',
  [ORDER_STATUS_PAID]: '支払済み',
  4: '決済失敗',
  [ORDER_STATUS_CANCELED]: 'キャンセル',
}

export function isOrderHistoryEntry(order) {
  return isOrderReceipt(order)
    && typeof order.created_at === 'string'
    && Number.isFinite(Date.parse(order.created_at))
    && Number.isInteger(order.status)
    && Object.hasOwn(ORDER_STATUS_LABELS, order.status)
    && Array.isArray(order.items)
    && order.items.every(isOrderItem)
}
