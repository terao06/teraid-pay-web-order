import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { registerOrder } from '../../../../src/features/order/api/orderApi.js'

const token = { type: 'Bearer', value: 'device-token' }
const receipt = { menu_order_id: 456, total_amount: '1400.000000', token_symbol: 'JPYC' }
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
