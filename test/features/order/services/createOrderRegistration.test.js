import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { createOrderRegistration } from '../../../../src/features/order/services/createOrderRegistration.js'

const deviceUuid = 'device-a'
const token = { deviceUuid, value: 'original-token' }
const refreshed = { deviceUuid, value: 'refreshed-token' }
const lines = [{ itemId: 10, quantity: 2, options: [] }]
const receipt = { menu_order_id: 456, total_amount: '1400.000000', token_symbol: 'JPYC' }

test('retries a 401 with the same session, order lines and key using a refreshed token', async () => {
  for (const rejectRefreshed of [false, true]) {
    const tokens = [token, refreshed]
    const invalidated = []
    const requests = []
    const submit = createOrderRegistration({
      auth: {
        getAccessToken: async () => tokens.shift(),
        invalidateAccessToken: (accessToken) => invalidated.push(accessToken),
      },
      async registerOrder(...args) {
        requests.push(args)
        if (args[3] === token || rejectRefreshed) throw new ApiError('Unauthorized', 401)
        return receipt
      },
    })

    if (rejectRefreshed) await assert.rejects(submit(deviceUuid, 123, lines, 'order-key'), { status: 401 })
    else assert.deepEqual(await submit(deviceUuid, 123, lines, 'order-key'), receipt)
    assert.deepEqual(requests, [[123, lines, 'order-key', token], [123, lines, 'order-key', refreshed]])
    assert.deepEqual(invalidated, rejectRefreshed ? [token, refreshed] : [token])
  }
})

test('requires a token for the current device', async () => {
  for (const accessToken of [null, { deviceUuid: 'device-b' }]) {
    const submit = createOrderRegistration({
      auth: { getAccessToken: async () => accessToken },
      registerOrder: () => assert.fail('Unexpected API request'),
    })
    await assert.rejects(submit(deviceUuid, 123, lines, 'order-key'), { status: 401 })
  }
})

test('surfaces non-authentication errors without resending the order', async () => {
  for (const status of [undefined, 404, 409, 422, 500]) {
    let attempts = 0
    const submit = createOrderRegistration({
      auth: {
        getAccessToken: async () => token,
        invalidateAccessToken: () => assert.fail('Unexpected token invalidation'),
      },
      async registerOrder() {
        attempts += 1
        throw new ApiError('Request failed', status)
      },
    })
    await assert.rejects(submit(deviceUuid, 123, lines, 'order-key'), { status })
    assert.equal(attempts, 1)
  }
})
