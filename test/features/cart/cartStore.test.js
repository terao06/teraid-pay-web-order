import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CartStorageError, createCartStore } from '../../../src/features/cart/cartStore.js'

const line = {
  key: '[10,"JPYC","500.000000",[]]',
  itemId: 10,
  name: '牛丼',
  tokenSymbol: 'JPYC',
  unitPrice: '500.000000',
  options: [],
  quantity: 2,
}

const emptyCart = { lines: [], pendingKey: null, receipt: null }
const receipt = { menu_order_id: 456, total_amount: '1400.000000', token_symbol: 'JPYC' }
const key = 'teraid-pay-cart:device-a:100'

function createStorage() {
  const entries = new Map()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
}

test('restores the current visit in the same storage and isolates other visits and devices', () => {
  const storage = createStorage()
  const store = createCartStore(() => storage)
  storage.setItem(key, JSON.stringify([line]))
  const reloaded = createCartStore(() => storage)
  assert.deepEqual(reloaded.load('device-a', 100), { ...emptyCart, lines: [line] })
  assert.deepEqual(reloaded.load('device-a', 101), emptyCart)
  assert.deepEqual(reloaded.load('device-b', 100), emptyCart)
  store.save('device-a', 100, emptyCart)
  assert.equal(storage.getItem(key), null)
})

test('handles malformed data and unavailable session storage', () => {
  const storage = createStorage()
  const store = createCartStore(() => storage)
  for (const raw of ['[', JSON.stringify([{ ...line, quantity: 0 }]), JSON.stringify([line, line])]) {
    storage.setItem(key, raw)
    assert.deepEqual(store.load('device-a', 100), emptyCart)
  }
  const blocked = createCartStore(() => { throw new Error('Storage disabled') })
  assert.deepEqual(blocked.load('device-a', 100), emptyCart)
  assert.throws(() => blocked.save('device-a', 100, { ...emptyCart, lines: [line] }), CartStorageError)
})

test('stores pending orders with their cart and replaces both with the receipt on success', () => {
  const storage = createStorage()
  const store = createCartStore(() => storage)
  const pending = { ...emptyCart, lines: [line], pendingKey: 'order-key' }
  const completed = { ...emptyCart, receipt }
  store.save('device-a', 100, pending)
  assert.deepEqual(store.load('device-a', 100), pending)
  store.save('device-a', 100, completed)
  assert.deepEqual(store.load('device-a', 100), completed)
  assert.deepEqual(store.load('device-a', 101), emptyCart)
})

test('rejects invalid pending order records without discarding them', () => {
  const storage = createStorage()
  const store = createCartStore(() => storage)
  const value = JSON.stringify({ ...emptyCart, pendingKey: 'order-key' })
  storage.setItem(key, value)
  assert.throws(() => store.load('device-a', 100), CartStorageError)
  assert.equal(storage.getItem(key), value)
})
