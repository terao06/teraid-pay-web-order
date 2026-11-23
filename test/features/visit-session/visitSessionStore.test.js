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
  const pending = { requestId: 'request-1' }
  const started = { ...pending, visitSessionId: 123 }

  visitSessionStore.save('first-device', pending)
  assert.deepEqual(visitSessionStore.load('first-device'), pending)
  visitSessionStore.save('first-device', started)
  visitSessionStore.save('second-device', { requestId: 'request-2' })
  assert.deepEqual(visitSessionStore.load('first-device'), started)

  visitSessionStore.clear('first-device')
  assert.equal(visitSessionStore.load('first-device'), null)
  assert.deepEqual(visitSessionStore.load('second-device'), {
    requestId: 'request-2',
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

test('restores older visits without a payment preference or a stale single-order checkout', (t) => {
  mockStorage(t)
  const pending = { requestId: 'request-1' }
  const visit = { ...pending, visitSessionId: 123 }
  for (const paymentMode of ['combined', 'per_order', null]) {
    visitSessionStore.save('device', { ...visit, paymentMode })
    assert.deepEqual(visitSessionStore.load('device'), visit)
  }
  visitSessionStore.save('device', { ...pending, paymentMode: 'per_order' })
  assert.deepEqual(visitSessionStore.load('device'), pending)

  visitSessionStore.save('device', {
    ...visit, paymentMode: 'per_order', checkout: { phase: 'create', orderId: 456 },
  })
  assert.deepEqual(visitSessionStore.load('device'), visit)
  visitSessionStore.save('device', {
    ...visit, paymentMode: 'combined', checkout: { phase: 'create', orderId: null },
  })
  assert.deepEqual(visitSessionStore.load('device'), { ...visit, checkout: { phase: 'create' } })
})

test('retains IDs and keys needed to recover legacy payments', (t) => {
  mockStorage(t)
  const visit = { requestId: 'request-1', visitSessionId: 123 }
  const summary = {
    checkout_id: 11, token_symbol: 'JPYC', total_amount: '100.000000',
    orders: [{ menu_order_id: 456, total_amount: '100.000000', items: [] }],
  }
  for (const [checkout, restored] of [
    [{ phase: 'sending', key: 'old-key', summary }, { phase: 'sending', key: 'old-key', summary, legacyPayment: true }],
    [{ phase: 'verify', paymentId: 33, summary }, { phase: 'verify', paymentId: 33, summary }],
    [{ phase: 'paid', summary }, { phase: 'complete', summary }],
  ]) {
    visitSessionStore.save('device', {
      ...visit, paymentMode: 'per_order', checkout: { ...checkout, orderId: 456 },
    })
    assert.deepEqual(visitSessionStore.load('device'), { ...visit, checkout: restored })
  }
})

test('rejects invalid checkout state and checkout state without a visit', (t) => {
  mockStorage(t)
  const record = { requestId: 'request-1', checkout: { phase: 'create' } }
  visitSessionStore.save('device', record)
  assert.throws(() => visitSessionStore.load('device'), VisitSessionStorageError)
  visitSessionStore.save('device', { ...record, visitSessionId: 123, checkout: { phase: 'sending' } })
  assert.throws(() => visitSessionStore.load('device'), VisitSessionStorageError)
})

test('restores the confirmed payment and order numbers before visit closure', (t) => {
  mockStorage(t)
  const record = {
    requestId: 'request-1',
    visitSessionId: 123,
    paidOrderIds: [456],
    checkout: {
      phase: 'paid',
      summary: {
        checkout_id: 11, token_symbol: 'JPYC', total_amount: '100.000000',
        orders: [{ menu_order_id: 456, total_amount: '100.000000', items: [] }],
      },
    },
  }
  visitSessionStore.save('device', record)
  assert.deepEqual(visitSessionStore.load('device'), record)
})

test('restores a checkout deferred by returning to the menu', (t) => {
  mockStorage(t)
  const record = { requestId: 'request-1', visitSessionId: 123, checkout: { phase: 'deferred' } }
  visitSessionStore.save('device', record)
  assert.deepEqual(visitSessionStore.load('device'), record)
  record.checkout.tokenSymbol = 'JPYC'
  visitSessionStore.save('device', record)
  assert.deepEqual(visitSessionStore.load('device'), record)
})

test('restores the original checkout ID and key for a deferred payment', (t) => {
  mockStorage(t)
  const record = {
    requestId: 'request-1',
    visitSessionId: 123,
    checkout: {
      phase: 'payment_deferred', key: 'payment-key', legacyPayment: true,
      summary: {
        checkout_id: 11, token_symbol: 'JPYC', total_amount: '100.000000',
        orders: [{ menu_order_id: 456, total_amount: '100.000000', items: [] }],
      },
    },
  }
  visitSessionStore.save('device', record)
  assert.deepEqual(visitSessionStore.load('device'), record)
})
