import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { createDeviceSession } from '../../../../src/features/device-auth/services/createDeviceSession.js'

const registration = { device_uuid: 'test-uuid', device_credential: 'test-credential' }
const token = { access_token: 'test-access-token', token_type: 'Bearer', expires_in: 300 }

function fixture(saved = registration) {
  const clock = { time: 0 }
  const requests = []
  const options = {
    async loadRegistration() { return saved },
    async requestDeviceToken(value) {
      requests.push(value)
      return token
    },
    now: () => clock.time,
  }
  return { options, requests, clock }
}

test('does not request a token until a registration has been saved', async () => {
  const { options, requests } = fixture(null)
  const session = createDeviceSession(options)

  assert.equal(await session.getAccessToken(), null)
  assert.deepEqual(requests, [])
})

test('authenticates from stored registration and retries after a 401', async () => {
  const { options, requests } = fixture()
  const request = options.requestDeviceToken
  let rejected = true
  options.requestDeviceToken = async (value) => {
    if (rejected) throw new ApiError('API request failed', 401)
    return request(value)
  }
  const session = createDeviceSession(options)

  await assert.rejects(session.getAccessToken(), { status: 401 })
  rejected = false

  assert.equal((await session.getAccessToken()).value, token.access_token)
  assert.deepEqual(requests, [registration])
})

test('refreshes before expiration and shares concurrent token requests', async () => {
  const { options, requests, clock } = fixture()
  const session = createDeviceSession(options)
  const first = await session.getAccessToken()

  assert.equal(first.refreshAt, 270_000)
  clock.time = first.refreshAt - 1
  assert.equal(await session.getAccessToken(), first)

  clock.time = first.refreshAt
  const [second, shared] = await Promise.all([session.getAccessToken(), session.getAccessToken()])
  assert.equal(second, shared)
  assert.ok(second.refreshAt > first.refreshAt)
  assert.deepEqual(requests, [registration, registration])
})

test('invalidates a rejected token without discarding a newer token', async () => {
  const { options, requests } = fixture()
  const session = createDeviceSession(options)
  const rejected = await session.getAccessToken()
  assert.equal(rejected.deviceUuid, registration.device_uuid)

  session.invalidateAccessToken(rejected)
  const fresh = await session.getAccessToken()
  assert.notEqual(fresh, rejected)
  session.invalidateAccessToken(rejected)
  assert.equal(await session.getAccessToken(), fresh)
  assert.deepEqual(requests, [registration, registration])
})

test('can authenticate a new registration while an earlier storage lookup is finishing', async () => {
  const { options, requests } = fixture()
  let finishEarlyLookup
  options.loadRegistration = () => {
    if (finishEarlyLookup) return Promise.resolve(registration)
    return new Promise((resolve) => { finishEarlyLookup = resolve })
  }
  const session = createDeviceSession(options)

  const earlyLookup = session.getAccessToken()
  assert.equal((await session.getAccessToken()).value, token.access_token)
  finishEarlyLookup(null)
  assert.equal(await earlyLookup, null)
  assert.deepEqual(requests, [registration])
})
