import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../src/components/api/apiClient.js'
import { createCartStore } from '../../../src/features/cart/cartStore.js'
import { useCartOrder } from '../../../src/features/cart/useCartOrder.js'

const line = { key: 'line-a', itemId: 10, name: '牛丼', tokenSymbol: 'JPYC', unitPrice: '700.000000', quantity: 2, options: [] }
const receipt = { menu_order_id: 456, total_amount: '1500.000000', token_symbol: 'JPYC' }
const deviceUuid = 'device-a'
const visitId = 123

function setup(sendOrder) {
  let raw = null
  let writeBlocked = false
  const storage = createCartStore(() => ({
    getItem: () => raw,
    setItem(_key, value) {
      if (writeBlocked) throw new Error('Write blocked')
      raw = value
    },
    removeItem: () => { raw = null },
  }))
  let nextKey = 0
  const openCart = (paidOrderIds) => useCartOrder(deviceUuid, visitId, {
    storage,
    sendOrder,
    generateKey: () => `order-key-${++nextKey}`,
    paidOrderIds,
  })
  return { storage, openCart, blockWrites: (value) => { writeBlocked = value } }
}

test('clears a paid receipt when returning to the same visit for additional orders', async () => {
  const { openCart, storage } = setup(async () => receipt)
  const cart = openCart()
  cart.changeLines([line])
  await cart.confirm()
  const nextCart = openCart([receipt.menu_order_id])
  assert.equal(nextCart.locked.value, false)
  assert.equal(nextCart.receipt.value, null)
  assert.equal(storage.load(deviceUuid, visitId).receipt, null)
})

test('saves the order before sending and prevents duplicate submits and edits in flight', async () => {
  let respond
  let calls = 0
  const { openCart, storage } = setup((device, visit, lines, key) => {
    calls += 1
    assert.deepEqual([device, visit, lines, key], [deviceUuid, visitId, [line], 'order-key-1'])
    assert.deepEqual(storage.load(device, visit), { lines: [line], pendingKey: key, receipt: null })
    return new Promise((resolve) => { respond = resolve })
  })
  const cart = openCart()
  cart.changeLines([line])
  const sending = cart.confirm()
  assert.equal(cart.sending.value, true)
  cart.changeLines([])
  await cart.confirm()
  assert.equal(calls, 1)
  assert.deepEqual(cart.lines.value, [line])
  respond(receipt)
  await sending
  assert.equal(cart.sending.value, false)
  assert.deepEqual(cart.lines.value, [])
  assert.deepEqual(cart.receipt.value, receipt)
  assert.deepEqual(openCart().receipt.value, receipt)
})

test('retries the exact same lines and key after a lost response and reload, then starts a separate order', async () => {
  const attempts = []
  const { openCart } = setup(async (_device, _visit, lines, key) => {
    attempts.push({ lines, key })
    if (attempts.length === 1) throw new ApiError('Connection failed')
    return receipt
  })
  const cart = openCart()
  cart.changeLines([line])
  await cart.confirm()
  assert.equal(cart.pending.value, true)
  assert.match(cart.orderError.value, /再試行/)
  const restored = openCart()
  restored.changeLines([])
  await restored.confirm()
  assert.deepEqual(attempts, Array(2).fill({ lines: [line], key: 'order-key-1' }))
  assert.deepEqual(restored.receipt.value, receipt)
  assert.equal(restored.continueOrdering(), true)
  restored.changeLines([line])
  await restored.confirm()
  assert.equal(attempts[2].key, 'order-key-2')
})

test('allows cart correction on an initial validation error and retains contents', async () => {
  const { openCart } = setup(async () => { throw new ApiError('Invalid items', 422) })
  const cart = openCart()
  cart.changeLines([line])
  await cart.confirm()
  assert.equal(cart.pending.value, false)
  assert.equal(cart.locked.value, false)
  assert.deepEqual(openCart().lines.value, [line])
  cart.changeLines([{ ...line, quantity: 1 }])
  assert.equal(cart.lines.value[0].quantity, 1)
})

test('preserves the original order on an error after an uncertain result', async () => {
  let attempts = 0
  const { openCart } = setup(async () => {
    attempts += 1
    throw new ApiError('Failed', attempts === 1 ? 500 : 422)
  })
  const cart = openCart()
  cart.changeLines([line])
  await cart.confirm()
  await cart.confirm()
  assert.equal(cart.pending.value, true)
  assert.deepEqual(openCart().lines.value, [line])
  assert.match(cart.orderError.value, /店舗スタッフ/)
})

test('blocks new orders for empty or mixed currency carts and when saving the key fails', async () => {
  let calls = 0
  const { openCart, blockWrites } = setup(async () => { calls += 1 })
  const cart = openCart()
  await cart.confirm()
  cart.changeLines([line, { ...line, key: 'line-b', tokenSymbol: 'USD' }])
  await cart.confirm()
  cart.changeLines([line])
  blockWrites(true)
  await cart.confirm()
  assert.equal(calls, 0)
  assert.equal(cart.pending.value, false)
  assert.deepEqual(cart.lines.value, [line])
  assert.match(cart.orderError.value, /保存/)
})

test('retries with the saved key if the receipt could not be stored', async () => {
  const keys = []
  const { openCart, blockWrites } = setup(async (_device, _visit, _lines, key) => {
    keys.push(key)
    blockWrites(keys.length === 1)
    return receipt
  })
  const cart = openCart()
  cart.changeLines([line])
  await cart.confirm()
  assert.deepEqual(cart.lines.value, [line])
  assert.equal(cart.pending.value, true)
  assert.equal(cart.receipt.value, null)
  await openCart().confirm()
  assert.deepEqual(keys, ['order-key-1', 'order-key-1'])
  assert.deepEqual(openCart().receipt.value, receipt)
})
