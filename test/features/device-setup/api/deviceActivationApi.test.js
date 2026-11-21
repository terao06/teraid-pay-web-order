import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { activateDevice } from '../../../../src/features/device-setup/api/deviceActivationApi.js'

const code = 'ABCD-EFGH-JKLM'
const registration = {
  device_uuid: '81004100-0000-4000-8000-000000000041',
  device_credential: 'test-device-credential',
}

test('sends the activation code and returns only the registration fields', async () => {
  const calls = []
  const request = async (path, options) => {
    calls.push([path, options])
    return { ...registration, extra: true }
  }

  assert.deepEqual(await activateDevice(code, request), registration)
  assert.deepEqual(calls, [
    ['/device/activate', { method: 'POST', body: { activation_code: code } }],
  ])
})

test('rejects malformed activation data and preserves HTTP activation errors', async () => {
  await assert.rejects(
    activateDevice(code, async () => ({ status: 'success', data: registration })),
    ApiError,
  )

  const failure = new ApiError('API request failed', 400)
  const request = async () => { throw failure }
  await assert.rejects(activateDevice(code, request), (error) => error === failure)
})
