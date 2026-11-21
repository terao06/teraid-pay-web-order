import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCartStore } from '../../../src/features/cart/cartStore.js'

const line = {
  key: '[10,"JPYC","500.000000",[]]',
  itemId: 10,
  name: '牛丼',
  tokenSymbol: 'JPYC',
  unitPrice: '500.000000',
  options: [],
  quantity: 2,
}

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
  store.save('device-a', 100, [line])
  const reloaded = createCartStore(() => storage)
  assert.deepEqual(reloaded.load('device-a', 100), [line])
  assert.deepEqual(reloaded.load('device-a', 101), [])
  assert.deepEqual(reloaded.load('device-b', 100), [])
  store.save('device-a', 100, [])
  assert.equal(storage.getItem('teraid-pay-cart:device-a:100'), null)
})

test('handles malformed data and unavailable session storage', () => {
  const storage = createStorage()
  const store = createCartStore(() => storage)
  const key = 'teraid-pay-cart:device-a:100'
  for (const raw of ['[', JSON.stringify([{ ...line, quantity: 0 }]), JSON.stringify([line, line])]) {
    storage.setItem(key, raw)
    assert.deepEqual(store.load('device-a', 100), [])
  }
  const blocked = createCartStore(() => { throw new Error('Storage disabled') })
  assert.deepEqual(blocked.load('device-a', 100), [])
  assert.doesNotThrow(() => blocked.save('device-a', 100, [line]))
})
