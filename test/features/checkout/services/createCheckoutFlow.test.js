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
      return { checkout_id: 11, token_symbol: 'JPYC', orders: [{ menu_order_id: 23 }, { menu_order_id: 24 }] }
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

test('combined payment survives reload and records paid orders before the visit is closed', async () => {
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
  assert.equal(state().checkout.phase, 'paid')
  assert.deepEqual(state().paidOrderIds, [23, 24])
  reload()
  await run('finish')
  assert.equal(state().checkout.phase, 'complete')
  await run('complete')
  assert.equal(state(), null)
  assert.deepEqual(calls, [
    ['create', visit, token], ['pay', 11, 'key-1', token],
    ['verify', 11, 33, token], ['verify', 11, 33, token],
    ['complete', visit, token], ['clearCart', device, visit], ['clearSession', device],
  ])
})

test('keeps the closure pending when the server response is lost', async () => {
  const { options, reload, state, run, review } = setup()
  const complete = options.completeVisitSession
  options.completeVisitSession = async () => { throw new ApiError('Connection lost') }
  reload()
  await review()
  await run('pay', 'photo')
  await run('verify')

  const paidCheckout = state().checkout
  await run('finish')
  const closing = state()
  assert.equal(closing.checkout.phase, 'complete')
  await assert.rejects(run('complete'), ApiError)
  await reload().continueOrdering(device, visit, paidCheckout)
  assert.deepEqual(state(), closing)

  options.completeVisitSession = complete
  reload()
  await run('complete')
  assert.equal(state(), null)
})

test('keeps the visit and its paid orders when the customer adds another order', async () => {
  const { calls, options, reload, state, run, review } = setup()
  await review()
  await run('pay', 'photo')
  await run('verify')

  const firstPayment = state().checkout
  await run('continueOrdering')
  assert.deepEqual(state(), { visitSessionId: visit, requestId: 'start', paidOrderIds: [23, 24] })
  const create = options.createCheckout
  options.createCheckout = async (...args) => {
    await create(...args)
    return { checkout_id: 12, orders: [{ menu_order_id: 25 }] }
  }
  const flow = reload()
  await flow.finish(device, visit, firstPayment)
  await run('order', async () => {
    calls.push(['order', state().visitSessionId, 25])
    return { menu_order_id: 25, token_symbol: 'JPYC' }
  })
  await run('create')
  await run('pay', 'photo')
  await run('verify')

  assert.equal(state().visitSessionId, visit)
  assert.deepEqual(state().paidOrderIds, [23, 24, 25])
  assert.deepEqual(calls, [
    ['create', visit, token], ['pay', 11, 'key-1', token], ['verify', 11, 33, token],
    ['order', visit, 25],
    ['create', visit, token], ['pay', 12, 'key-2', token], ['verify', 12, 33, token],
  ])
})

test('reconciles an already closed visit after verifying a paid order', async () => {
  const { options, reload, state, run, review } = setup()
  options.verifyPayment = async () => ({ status: 'paid', visit_session_status: 'closed' })
  reload()
  await review()
  await run('pay', 'photo')
  await run('verify')
  assert.equal(state().checkout.phase, 'complete')
})

test('starts checkout as soon as the first order is confirmed and blocks another tab from ordering', async () => {
  const { calls, reload, state, run } = setup()
  await run('order', async () => undefined)
  assert.equal(state().checkout, undefined)
  await Promise.all([
    run('order', async () => {
      calls.push(['order', 23])
      return { menu_order_id: 23, token_symbol: 'JPYC' }
    }),
    reload().order(device, visit, undefined, async () => { calls.push(['order', 24]) }),
  ])
  assert.deepEqual(state().checkout, { phase: 'create' })
  await run('create')
  assert.equal(state().checkout.phase, 'review')
  assert.deepEqual(calls, [['order', 23], ['create', visit, token]])
})

test('keeps the customer in checkout until payment is confirmed', async () => {
  const { calls, options, state, run, review } = setup()
  await review()
  const { summary } = state().checkout

  for (const checkout of [
    { phase: 'create' },
    { phase: 'review', summary },
    { phase: 'sending', summary, key: 'payment-key' },
    { phase: 'verify', summary, paymentId: 33 },
    { phase: 'failed', summary },
  ]) {
    options.storage.save(device, { ...state(), checkout })
    await run('backToMenu')
    await run('continueOrdering')
    await run('finish')
    await run('order', async () => assert.fail('Checkout must block new orders until payment is confirmed'))
    assert.deepEqual(state().checkout, checkout)
  }
  assert.deepEqual(calls, [['create', visit, token]])
})

test('recovers additional items from a checkout saved as deferred by an older version', async () => {
  const { calls, options, reload, state, run, review } = setup()
  await review()
  const original = state().checkout.summary
  const create = options.createCheckout
  options.createCheckout = async (...args) => {
    const summary = await create(...args)
    return { ...summary, checkout_id: 12, orders: [...summary.orders, { menu_order_id: 25 }] }
  }

  options.storage.save(device, { ...state(), checkout: { phase: 'deferred', tokenSymbol: 'JPYC' } })
  reload()
  await run('order', async () => {
    calls.push(['order', 25])
    return { menu_order_id: 25, token_symbol: 'JPYC' }
  })
  await run('create')

  const { checkout } = state()
  assert.equal(checkout.phase, 'review')
  assert.equal(checkout.summary.checkout_id, 12)
  assert.deepEqual(checkout.summary.orders, [...original.orders, { menu_order_id: 25 }])
  assert.deepEqual(calls, [['create', visit, token], ['order', 25], ['create', visit, token]])
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
  const pending = state().checkout
  assert.equal(pending.phase, 'sending')
  await run('backToMenu')
  assert.deepEqual(state().checkout, pending)
  const otherTab = reload()
  await Promise.all([run('pay', 'photo again'), otherTab.pay(device, visit, pending, 'photo')])
  assert.equal(state().checkout.phase, 'verify')
  assert.equal(calls.filter(([action]) => action === 'create').length, 1)
  assert.deepEqual(calls.filter(([action]) => action === 'pay'), Array(2).fill(['pay', 11, 'key-1', token]))
})

test('resumes an older deferred payment with the original checkout and key', async () => {
  const { calls, options, state, run } = setup()
  const pending = { phase: 'sending', summary: { checkout_id: 11 }, key: 'key-before-update' }
  options.storage.save(device, { ...state(), checkout: { ...pending, phase: 'payment_deferred' } })

  await run('order', async () => assert.fail('A deferred payment must block new orders'))
  await run('begin')
  assert.deepEqual(state().checkout, pending)
  await run('pay', 'photo')
  assert.deepEqual(calls, [['pay', 11, 'key-before-update', token]])
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
  await run('finish')
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

test('can finish from the menu and return if additional orders are outstanding', async () => {
  const { options, reload, state, run } = setup()
  options.storage.save(device, { ...state(), paidOrderIds: [23] })
  options.completeVisitSession = async () => { throw new ApiError('Unpaid orders', 409) }
  reload()
  await run('finish')
  assert.equal(state().checkout.phase, 'complete')
  await assert.rejects(run('complete'), { status: 409 })
  await run('backToMenu')
  assert.equal(state().checkout, undefined)
  assert.deepEqual(state().paidOrderIds, [23])
})

test('can finish an empty visit from the menu without creating a checkout', async () => {
  const { calls, state, run } = setup()
  await run('finish')
  assert.deepEqual(state().checkout, { phase: 'complete' })

  await run('complete')
  assert.equal(state(), null)
  assert.deepEqual(calls, [['complete', visit, token], ['clearCart', device, visit], ['clearSession', device]])
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
