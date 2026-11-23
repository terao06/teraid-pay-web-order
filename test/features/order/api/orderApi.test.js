import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { getOrderHistory, registerOrder } from '../../../../src/features/order/api/orderApi.js'

const token = { type: 'Bearer', value: 'device-token' }
const receipt = { menu_order_id: 456, total_amount: '1400.000000', token_symbol: 'JPYC' }
const historyEntry = {
  ...receipt,
  created_at: '2026-11-21T03:00:00Z',
  status: 1,
  items: [{
    menu_item_name: 'チーズバーガー',
    quantity: 2,
    unit_price: '600.000000',
    line_amount: '1400.000000',
    options: [{
      option_group_name: 'トッピング',
      option_name: 'チーズ追加',
      additional_price: '100.000000',
      option_quantity: 1,
    }],
  }],
}
const lines = [
  { itemId: 10, quantity: 2, unitPrice: '600.000000', options: [{ id: 30, additionalPrice: '100.000000' }] },
  { itemId: 10, quantity: 1, unitPrice: '600.000000', options: [] },
]

test('posts product and option quantities with the session token and idempotency key', async () => {
  const result = await registerOrder(123, lines, 'order-key', token, async (path, options) => {
    assert.equal(path, '/device/visit-sessions/123/orders')
    assert.deepEqual(options, {
      method: 'POST',
      headers: { Authorization: 'Bearer device-token', 'Idempotency-Key': 'order-key' },
      body: {
        items: [
          { menu_item_id: 10, quantity: 2, options: [{ menu_option_id: 30, option_quantity: 1 }] },
          { menu_item_id: 10, quantity: 1, options: [] },
        ],
      },
    })
    return receipt
  })
  assert.deepEqual(result, receipt)
})

test('rejects unsafe session IDs and invalid order responses', async () => {
  for (const id of [0, '123', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(registerOrder(id, lines, 'order-key', token, () => {
      assert.fail('Unexpected API request')
    }), TypeError)
  }
  for (const data of [
    null,
    { ...receipt, menu_order_id: 0 },
    { ...receipt, menu_order_id: Number.MAX_SAFE_INTEGER + 1 },
    { ...receipt, total_amount: '1400' },
    { ...receipt, total_amount: 1400 },
    { ...receipt, token_symbol: '' },
  ]) {
    await assert.rejects(registerOrder(123, lines, 'order-key', token, async () => data), ApiError)
  }
})

test('gets the session order history with device authorization and preserves the response order', async () => {
  const orders = [historyEntry, { ...historyEntry, menu_order_id: 455, status: 3, items: [] }]
  for (const expected of [orders, []]) {
    const result = await getOrderHistory(123, token, async (path, options) => {
      assert.equal(path, '/device/visit-sessions/123/orders')
      assert.deepEqual(options, { method: 'GET', headers: { Authorization: 'Bearer device-token' } })
      return { orders: expected }
    })
    assert.deepEqual(result, expected)
  }
})

test('rejects invalid history identifiers and malformed details, and preserves server errors', async () => {
  await assert.rejects(getOrderHistory('123', token, () => {
    assert.fail('Unexpected API request')
  }), TypeError)

  for (const data of [
    null,
    { orders: {} },
    { orders: [{ ...historyEntry, created_at: 'unknown' }] },
    { orders: [{ ...historyEntry, status: '1' }] },
    { orders: [{ ...historyEntry, status: 6 }] },
    { orders: [{ ...historyEntry, items: [{ ...historyEntry.items[0], options: null }] }] },
  ]) {
    await assert.rejects(getOrderHistory(123, token, async () => data), /Invalid order history response/)
  }

  const failure = new ApiError('Visit not found', 404)
  await assert.rejects(getOrderHistory(123, token, async () => { throw failure }), failure)
})
