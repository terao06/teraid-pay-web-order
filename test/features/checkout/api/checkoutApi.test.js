import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import {
  createCheckout, startFacePayment, verifyPayment,
} from '../../../../src/features/checkout/api/checkoutApi.js'

const token = { type: 'Bearer', value: 'test-token' }
const summary = {
  checkout_id: 11, token_symbol: 'JPYC', total_amount: '100.000000',
  orders: [{
    menu_order_id: 23, total_amount: '100.000000',
    items: [{ menu_item_name: '商品', quantity: 1, unit_price: '100.000000', line_amount: '100.000000', options: [] }],
  }],
}

test('creates an authenticated checkout for all unpaid orders', async () => {
  const multipleOrders = {
    ...summary, total_amount: '200.000000',
    orders: [summary.orders[0], { ...summary.orders[0], menu_order_id: 24 }],
  }
  const checkout = await createCheckout(7, token, async (path, options) => {
    assert.equal(path, '/device/visit-sessions/7/checkouts')
    assert.deepEqual(options, {
      method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: { scope: 'all_unpaid' },
    })
    return multipleOrders
  })
  assert.deepEqual(checkout, multipleOrders)
})

test('posts the face image and idempotency key, then verifies the returned payment ID with no body', async () => {
  const payment = await startFacePayment(11, 'payment-key', 'ZmFjZQ==', token, async (path, options) => {
    assert.equal(path, '/device/checkouts/11/payments/face')
    assert.deepEqual(options, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Idempotency-Key': 'payment-key' },
      body: { content: 'ZmFjZQ==' },
    })
    return { payment_request_id: 33, status: 'confirming' }
  })
  const result = await verifyPayment(11, payment.payment_request_id, token, async (path, options) => {
    assert.equal(path, '/device/checkouts/11/payments/33/verify')
    assert.deepEqual(options, { method: 'POST', headers: { Authorization: 'Bearer test-token' } })
    return { payment_request_id: 33, status: 'paid', visit_session_status: 'active' }
  })
  assert.equal(result.status, 'paid')
})

test('rejects empty or malformed checkout summaries and a result for a different payment', async () => {
  await assert.rejects(createCheckout(7, token, async () => ({ ...summary, orders: [] })), ApiError)
  await assert.rejects(createCheckout(7, token, async () => ({ ...summary, total_amount: '4' })), ApiError)
  const wideTotal = { ...summary, total_amount: '100000000000000.000000' }
  assert.deepEqual(await createCheckout(7, token, async () => wideTotal), wideTotal)
  await assert.rejects(startFacePayment(11, 'key', 'ZmFjZQ==', token, async () => ({
    payment_request_id: 33, status: 'unknown',
  })), ApiError)
  await assert.rejects(verifyPayment(11, 33, token, async () => ({
    payment_request_id: 34, status: 'paid', visit_session_status: 'active',
  })), ApiError)
})
