import { ApiError, requestJson } from '../../../components/api/apiClient.js'
import { VISIT_SESSION_START_PATH } from '../../visit-session/api/visitSessionApi.js'
import { isOrderHistoryEntry } from '../orderHistoryEntry.js'
import { isOrderReceipt } from '../orderReceipt.js'

export const ORDER_PATH_SUFFIX = '/orders'

function ordersPath(visitSessionId) {
  if (!Number.isSafeInteger(visitSessionId) || visitSessionId < 1) {
    throw new TypeError('Invalid visit session ID')
  }
  return `${VISIT_SESSION_START_PATH}/${visitSessionId}${ORDER_PATH_SUFFIX}`
}

export async function registerOrder(visitSessionId, lines, idempotencyKey, token, request = requestJson) {
  const data = await request(ordersPath(visitSessionId), {
    method: 'POST',
    headers: {
      Authorization: `${token.type} ${token.value}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: {
      items: lines.map((line) => ({
        menu_item_id: line.itemId,
        quantity: line.quantity,
        options: line.options.map(({ id }) => ({ menu_option_id: id, option_quantity: 1 })),
      })),
    },
  })
  if (!isOrderReceipt(data)) throw new ApiError('Invalid order response')
  return data
}

export async function getOrderHistory(visitSessionId, token, request = requestJson) {
  const data = await request(ordersPath(visitSessionId), {
    method: 'GET',
    headers: { Authorization: `${token.type} ${token.value}` },
  })
  if (!Array.isArray(data?.orders) || !data.orders.every(isOrderHistoryEntry)) {
    throw new ApiError('Invalid order history response')
  }
  return data.orders
}
