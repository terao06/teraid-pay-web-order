import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  visitSessionStore, VisitSessionStorageError,
} from '../../../src/features/visit-session/visitSessionStore.js'

function mockStorage(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  })
  return storage
}

test('stores and clears a pending or completed start separately for each registered device', (t) => {
  mockStorage(t)
  const pending = { requestId: 'request-1', paymentMode: 'combined' }
  const started = { ...pending, visitSessionId: 123 }

  visitSessionStore.save('first-device', pending)
  assert.deepEqual(visitSessionStore.load('first-device'), pending)
  visitSessionStore.save('first-device', started)
  visitSessionStore.save('second-device', { requestId: 'request-2', paymentMode: 'per_order' })
  assert.deepEqual(visitSessionStore.load('first-device'), started)

  const reset = { ...started, paymentMode: null }
  visitSessionStore.save('first-device', reset)
  assert.deepEqual(visitSessionStore.load('first-device'), reset)

  visitSessionStore.clear('first-device')
  assert.equal(visitSessionStore.load('first-device'), null)
  assert.deepEqual(visitSessionStore.load('second-device'), {
    requestId: 'request-2',
    paymentMode: 'per_order',
  })
})

test('reports damaged data and inaccessible browser storage', (t) => {
  const storage = mockStorage(t)
  const key = 'teraid-pay-visit-session:test-device'

  for (const value of [
    'bad json',
    '{"requestId":"x","paymentMode":"unknown"}',
    '{"requestId":"x","paymentMode":"combined","visitSessionId":0}',
    '{"requestId":"x","paymentMode":null}',
  ]) {
    storage.setItem(key, value)
    assert.throws(() => visitSessionStore.load('test-device'), VisitSessionStorageError)
  }
  storage.setItem = () => { throw new Error('Quota exceeded') }
  assert.throws(() => visitSessionStore.save('test-device', {}), VisitSessionStorageError)
})

test('restores checkout state only when its visit and payment mode match', (t) => {
  mockStorage(t)
  const record = {
    requestId: 'request-1', paymentMode: 'per_order', visitSessionId: 123,
    checkout: { phase: 'create', orderId: 456 },
  }
  visitSessionStore.save('device', record)
  assert.deepEqual(visitSessionStore.load('device'), record)
  visitSessionStore.save('device', { ...record, paymentMode: 'combined' })
  assert.throws(() => visitSessionStore.load('device'), VisitSessionStorageError)
  visitSessionStore.save('device', { ...record, paymentMode: null })
  assert.throws(() => visitSessionStore.load('device'), VisitSessionStorageError)
})
