import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { createOrderHistory } from '../../../../src/features/order/services/createOrderHistory.js'

const deviceUuid = 'device-a'
const token = { deviceUuid, value: 'old-token' }
const refreshed = { deviceUuid, value: 'new-token' }

test('retries an unauthorized history request with a refreshed token for the same visit', async (t) => {
  const getAccessToken = t.mock.fn()
  getAccessToken.mock.mockImplementationOnce(async () => token)
  getAccessToken.mock.mockImplementationOnce(async () => refreshed, 1)
  const invalidateAccessToken = t.mock.fn()
  const getOrderHistory = t.mock.fn(async (_session, accessToken) => {
    if (accessToken === token) throw new ApiError('Unauthorized', 401)
    return []
  })

  const load = createOrderHistory({ auth: { getAccessToken, invalidateAccessToken }, getOrderHistory })
  assert.deepEqual(await load(deviceUuid, 123), [])
  assert.deepEqual(getOrderHistory.mock.calls.map(({ arguments: args }) => args), [[123, token], [123, refreshed]])
  assert.deepEqual(invalidateAccessToken.mock.calls.map(({ arguments: args }) => args), [[token]])
})

test('blocks tokens for another device and surfaces non-authentication errors without retry', async (t) => {
  const failure = new ApiError('Unavailable', 500)
  const getOrderHistory = t.mock.fn(async () => { throw failure })
  const load = createOrderHistory({ auth: { getAccessToken: async () => token }, getOrderHistory })

  await assert.rejects(load('wrong-device', 123), { status: 401 })
  assert.equal(getOrderHistory.mock.callCount(), 0)
  await assert.rejects(load(deviceUuid, 123), failure)
  assert.equal(getOrderHistory.mock.callCount(), 1)
})
