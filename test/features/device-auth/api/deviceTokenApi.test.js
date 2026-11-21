import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { requestDeviceToken } from '../../../../src/features/device-auth/api/deviceTokenApi.js'

const registration = {
  device_uuid: '81004100-0000-4000-8000-000000000041',
  device_credential: 'test-device-credential',
}
const token = { access_token: 'test-access-token', token_type: 'Bearer', expires_in: 300 }

test('sends only the registration fields to the token endpoint', async () => {
  const calls = []
  const request = async (path, options) => {
    calls.push([path, options])
    return token
  }

  assert.deepEqual(await requestDeviceToken({ ...registration, extra: true }, request), token)
  assert.deepEqual(calls, [
    ['/device/auth/token', { method: 'POST', body: registration }],
  ])
})

test('rejects malformed token payloads and preserves HTTP authentication errors', async () => {
  await assert.rejects(requestDeviceToken(registration, async () => ({ ...token, expires_in: 0 })), ApiError)

  const failure = new ApiError('API request failed', 401)
  const request = async () => { throw failure }
  await assert.rejects(requestDeviceToken(registration, request), (error) => error === failure)
})
