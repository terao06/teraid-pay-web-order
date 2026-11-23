import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, h, nextTick, ref } from 'vue'
import { ApiError } from '../../../src/components/api/apiClient.js'
import { useCheckoutFlow } from '../../../src/features/checkout/useCheckoutFlow.js'

function mountFlow(t, record, restore, flow) {
  const renderer = createRenderer({ insert() {}, remove() {}, createElement: () => ({}) })
  let checkout
  const app = renderer.createApp({
    setup() {
      checkout = useCheckoutFlow('device', record, restore, flow)
      return () => h('section')
    },
  })
  app.mount({})
  t.after(() => app.unmount())
  return checkout
}

async function tick(t, milliseconds) {
  t.mock.timers.tick(milliseconds)
  await Promise.resolve()
  await nextTick()
}

test('keeps polling restored payments through confirming results and transient errors', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const visitSessionId = 7
  let saved = { visitSessionId, checkout: { phase: 'verify', paymentId: 33 } }
  const record = ref(saved)
  const calls = []
  const flow = {
    async verify(device, visit, { paymentId }) {
      calls.push(['verify', device, visit, paymentId])
      if (calls.length === 1) throw new ApiError('RPC temporarily unavailable', 503)
      if (calls.length === 2) return
      saved = { ...saved, checkout: { phase: 'complete' } }
    },
    async complete(device, visit) {
      calls.push(['complete', device, visit])
      saved = null
      return true
    },
  }
  const checkout = mountFlow(t, record, () => { record.value = saved }, flow)

  assert.equal(checkout.polling.value, true)
  await tick(t, 0)
  assert.equal(calls.length, 1)
  assert.equal(checkout.busy.value, false)
  assert.equal(checkout.polling.value, true)
  assert.notEqual(checkout.message.value, '')

  await tick(t, 2999)
  assert.equal(calls.length, 1)
  await tick(t, 1)
  assert.equal(calls.length, 2)
  assert.equal(checkout.polling.value, true)
  assert.equal(checkout.message.value, '')

  await tick(t, 3000)
  assert.equal(checkout.polling.value, false)
  assert.equal(checkout.completedVisit.value, null)
  await tick(t, 0)
  assert.equal(record.value, null)
  assert.equal(checkout.completedVisit.value, visitSessionId)
  assert.deepEqual(calls, [
    ['verify', 'device', 7, 33], ['verify', 'device', 7, 33],
    ['verify', 'device', 7, 33], ['complete', 'device', 7],
  ])
})

test('stops automatic verification on a non-retryable error and resumes on explicit retry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let saved = { visitSessionId: 7, checkout: { phase: 'verify', paymentId: 33 } }
  const record = ref(saved)
  let attempts = 0
  const checkout = mountFlow(t, record, () => { record.value = saved }, {
    async verify() {
      attempts += 1
      if (attempts === 1) throw new ApiError('Verification rejected', 422)
      saved = { ...saved, checkout: { phase: 'failed' } }
    },
  })

  await tick(t, 0)
  assert.equal(checkout.polling.value, false)
  assert.notEqual(checkout.message.value, '')
  await tick(t, 6000)
  assert.equal(attempts, 1)

  const retry = checkout.run('verify')
  assert.equal(checkout.polling.value, true)
  await retry
  assert.equal(attempts, 2)
  assert.equal(checkout.polling.value, false)
  assert.equal(checkout.completedVisit.value, null)
})

test('reports the payment-start request until a payment can be verified', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let saved = { visitSessionId: 7, checkout: { phase: 'review' } }
  const record = ref(saved)
  const payment = Promise.withResolvers()
  const checkout = mountFlow(t, record, () => { record.value = saved }, {
    async pay() {
      await payment.promise
      saved = { ...saved, checkout: { phase: 'verify', paymentId: 33 } }
    },
  })

  const send = checkout.run('pay', 'test-image')
  assert.equal(checkout.activeAction.value, 'pay')
  assert.equal(checkout.busy.value, true)
  assert.equal(checkout.polling.value, false)
  payment.resolve()
  await send
  assert.equal(checkout.activeAction.value, null)
  assert.equal(checkout.polling.value, true)
})

test('announces only a confirmed visit closure', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const result of [undefined, true]) {
    const completed = { visitSessionId: 7, checkout: { phase: 'complete' } }
    const record = ref(completed)
    let saved = completed
    let attempts = 0
    const checkout = mountFlow(t, record, () => { record.value = saved }, {
      async complete() {
        attempts += 1
        if (attempts === 1) throw new ApiError('Closure unavailable', 503)
        if (result) saved = null
        return result
      },
    })

    await checkout.run('complete')
    assert.equal(checkout.completedVisit.value, null)
    assert.notEqual(checkout.message.value, '')
    await checkout.run('complete')
    assert.equal(checkout.completedVisit.value, result ? 7 : null)
  }
})
