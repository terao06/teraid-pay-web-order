import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { createCheckoutFlow } from '../../../../src/features/checkout/services/createCheckoutFlow.js'

const device = 'test-device'
const visit = 7
const token = { deviceUuid: device, type: 'Bearer', value: 'test-token' }

function setup() {
  const calls = []
  let record = { visitSessionId: visit, requestId: 'start' }
  let lock = Promise.resolve()
  let key = 0
  const options = {
    auth: { getAccessToken: async () => token, invalidateAccessToken() {} },
    storage: {
      load: () => structuredClone(record),
      save: (_uuid, next) => { record = structuredClone(next) },
      clear: (uuid) => { calls.push(['clearSession', uuid]); record = null },
    },
    withLock(_uuid, work) {
      const next = lock.then(work)
      lock = next.catch(() => {})
      return next
    },
    generateKey: () => `key-${++key}`,
    createCheckout: async (id, accessToken) => {
      calls.push(['create', id, accessToken])
      return { checkout_id: 11, orders: [{ menu_order_id: 23 }, { menu_order_id: 24 }] }
    },
    startFacePayment: async (id, idempotencyKey, _content, accessToken) => {
      calls.push(['pay', id, idempotencyKey, accessToken])
      assert.equal(record.checkout.key, idempotencyKey)
      return { payment_request_id: 33 }
    },
    verifyPayment: async (id, paymentId, accessToken) => {
      calls.push(['verify', id, paymentId, accessToken])
      return { status: 'paid', visit_session_status: 'active' }
    },
    completeVisitSession: async (id, accessToken) => { calls.push(['complete', id, accessToken]) },
    clearCart: (uuid, id) => { calls.push(['clearCart', uuid, id]) },
  }
  let flow
  const reload = () => { flow = createCheckoutFlow(options); return flow }
  reload()
  const run = (action, input) => flow[action](device, visit, structuredClone(record?.checkout), input)
  async function review() {
    await run('begin')
    await run('create')
  }
  return { calls, options, state: options.storage.load, run, reload, review }
}

test('combined payment survives reload and automatically becomes eligible to close after verification', async () => {
  const { calls, options, state, run, reload, review } = setup()
  const verify = options.verifyPayment
  options.verifyPayment = async (...args) => {
    if (!calls.some(([action]) => action === 'verify')) {
      await verify(...args)
      return { status: 'confirming', visit_session_status: 'checkout_processing' }
    }
    return verify(...args)
  }
  reload()
  await review()
  await run('pay', 'face-image')
  assert.doesNotMatch(JSON.stringify(state()), /face-image/)
  assert.equal(state().checkout.phase, 'verify')
  reload()
  await run('verify')
  assert.equal(state().checkout.phase, 'verify')
  await run('verify')
  assert.equal(state().checkout.phase, 'complete')
  assert.deepEqual(state().paidOrderIds, [23, 24])
  await run('complete')
  assert.equal(state(), null)
  assert.deepEqual(calls, [
    ['create', visit, token], ['pay', 11, 'key-1', token],
    ['verify', 11, 33, token], ['verify', 11, 33, token],
    ['complete', visit, token], ['clearCart', device, visit], ['clearSession', device],
  ])
})

test('keeps taking additional orders until checkout is requested', async () => {
  const { calls, state, run, review } = setup()
  const order = (orderId) => run('order', async () => { calls.push(['order', orderId]) })
  await order(23)
  await order(24)
  assert.equal(state().checkout, undefined)
  await review()
  assert.equal(state().checkout.phase, 'review')
  assert.deepEqual(calls, [['order', 23], ['order', 24], ['create', visit, token]])
})

test('keeps the same checkout and key across lost responses and serializes stale concurrent submissions', async () => {
  const { calls, options, state, run, reload, review } = setup()
  const send = options.startFacePayment
  options.startFacePayment = async (...args) => {
    const payment = await send(...args)
    if (calls.filter(([action]) => action === 'pay').length === 1) throw new ApiError('Connection lost')
    return payment
  }
  reload()
  await review()
  await assert.rejects(run('pay', 'photo'), ApiError)
  assert.equal(state().checkout.phase, 'sending')
  await run('backToMenu')
  assert.equal(state().checkout.phase, 'sending')
  const otherTab = reload()
  const pending = state().checkout
  await Promise.all([run('pay', 'photo again'), otherTab.pay(device, visit, pending, 'photo')])
  assert.equal(state().checkout.phase, 'verify')
  assert.deepEqual(calls.filter(([action]) => action === 'pay'), Array(2).fill(['pay', 11, 'key-1', token]))
})

test('recreates changed or failed checkouts, while face rejection returns to review', async () => {
  const { options, state, run, reload, review } = setup()
  const pay = options.startFacePayment
  options.startFacePayment = async () => { throw new ApiError('Invalid face', 400) }
  reload()
  await review()
  await assert.rejects(run('pay', 'photo'), { status: 400 })
  assert.equal(state().checkout.phase, 'review')
  options.startFacePayment = async () => { throw new ApiError('Checkout changed', 409) }
  reload()
  await assert.rejects(run('pay', 'photo'), { status: 409 })
  assert.equal(state().checkout.phase, 'create')
  options.startFacePayment = pay
  options.verifyPayment = async () => ({ status: 'tx_failed', visit_session_status: 'active' })
  reload()
  await run('create')
  await run('pay', 'photo')
  await run('verify')
  assert.equal(state().checkout.phase, 'failed')
  await run('retryCheckout')
  assert.deepEqual(state().checkout, { phase: 'create' })
})

test('retains the visit on completion conflict or lost response and retries the same session', async () => {
  const { calls, options, state, run, reload, review } = setup()
  const complete = options.completeVisitSession
  options.completeVisitSession = async (...args) => {
    await complete(...args)
    const count = calls.filter(([action]) => action === 'complete').length
    if (count === 1) throw new ApiError('Unpaid orders', 409)
    if (count === 2) throw new ApiError('Connection lost')
  }
  reload()
  await review()
  await run('pay', 'photo')
  await run('verify')
  await assert.rejects(run('complete'), { status: 409 })
  assert.equal(state().checkout.phase, 'completion_blocked')
  const staleCheckout = state().checkout
  await run('retryCompletion')
  await assert.rejects(run('complete'), ApiError)
  assert.equal(state().checkout.phase, 'complete')
  await reload().backToMenu(device, visit, staleCheckout)
  assert.equal(state().checkout.phase, 'complete')
  await run('complete')
  assert.equal(state(), null)
  assert.deepEqual(calls.slice(-5), [
    ...Array(3).fill(['complete', visit, token]), ['clearCart', device, visit], ['clearSession', device],
  ])
})

test('blocks a stale order from another tab once checkout has started', async () => {
  const { reload, state, run } = setup()
  const flow = reload()
  let confirmCount = 0
  await Promise.all([
    run('begin'),
    flow.order(device, visit, undefined, async () => { confirmCount += 1 }),
  ])
  assert.equal(confirmCount, 0)
  assert.deepEqual(state().checkout, { phase: 'create' })
})

test('can finish a previously paid visit and return to the menu if additional orders are outstanding', async () => {
  const { options, reload, state, run } = setup()
  options.storage.save(device, { ...state(), paidOrderIds: [23] })
  options.completeVisitSession = async () => { throw new ApiError('Unpaid orders', 409) }
  reload()
  await run('begin', true)
  assert.equal(state().checkout.phase, 'complete')
  await assert.rejects(run('complete'), { status: 409 })
  await run('backToMenu')
  assert.equal(state().checkout, undefined)
  assert.deepEqual(state().paidOrderIds, [23])
})

test('replays an old payment with its existing key and recreates the checkout when the API rejects it', async () => {
  const { calls, options, reload, state, run } = setup()
  options.storage.save(device, {
    ...state(), checkout: { phase: 'sending', summary: { checkout_id: 9 }, key: 'old-key', legacyPayment: true },
  })
  const send = options.startFacePayment
  options.startFacePayment = async (...args) => {
    await send(...args)
    if (calls.length === 1) throw new ApiError('Connection lost')
    throw new ApiError('Checkout changed', 409)
  }
  reload()
  await assert.rejects(run('pay', 'photo'), ApiError)
  assert.equal(state().checkout.phase, 'sending')
  await assert.rejects(run('pay', 'photo'), { status: 409 })
  assert.deepEqual(state().checkout, { phase: 'create' })
  await run('create')
  assert.equal(state().checkout.phase, 'review')
  assert.deepEqual(calls, [['pay', 9, 'old-key', token], ['pay', 9, 'old-key', token], ['create', visit, token]])
})
