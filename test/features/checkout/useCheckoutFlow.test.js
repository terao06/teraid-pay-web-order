import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, h, nextTick, ref } from 'vue'
import { ApiError } from '../../../src/components/api/apiClient.js'
import { useCheckoutFlow } from '../../../src/features/checkout/useCheckoutFlow.js'

test('automatically verifies restored payments, retries temporary errors and closes combined visits', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const renderer = createRenderer({ insert() {}, remove() {}, createElement: () => ({}) })
  const visitSessionId = 7
  let saved = { visitSessionId, checkout: { phase: 'verify', paymentId: 33 } }
  const record = ref(saved)
  const calls = []
  const flow = {
    async verify(device, visit, { paymentId }) {
      calls.push(['verify', device, visit, paymentId])
      if (calls.length === 1) throw new ApiError('RPC temporarily unavailable', 503)
      saved = { visitSessionId, checkout: { phase: 'complete' } }
    },
    async complete(device, visit) {
      calls.push(['complete', device, visit])
      saved = null
    },
  }
  const app = renderer.createApp({
    setup() {
      useCheckoutFlow('device', record, () => { record.value = saved }, flow)
      return () => h('section')
    },
  })
  app.mount({})
  t.after(() => app.unmount())

  async function tick(milliseconds) {
    t.mock.timers.tick(milliseconds)
    await Promise.resolve()
    await nextTick()
  }

  await tick(0)
  assert.equal(calls.length, 1)
  await tick(2999)
  assert.equal(calls.length, 1)
  await tick(1)
  assert.equal(calls.length, 2)
  await tick(0)
  assert.equal(record.value, null)
  assert.deepEqual(calls, [
    ['verify', 'device', 7, 33], ['verify', 'device', 7, 33], ['complete', 'device', 7],
  ])
})
