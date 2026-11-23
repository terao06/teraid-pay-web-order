import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { createVisitSession } from '../../../../src/features/visit-session/services/createVisitSession.js'

const deviceUuid = 'test-device'
const token = { type: 'Bearer', value: 'test-token', deviceUuid }
const pending = { requestId: 'request-1' }
const started = { ...pending, visitSessionId: 123 }

function fixture() {
  let lock = Promise.resolve()
  let requestCount = 0
  const records = new Map()
  const calls = []
  const options = {
    auth: {
      async getAccessToken() { return token },
      invalidateAccessToken() {},
    },
    storage: {
      load: (uuid) => records.get(uuid) ?? null,
      save: (uuid, record) => records.set(uuid, record),
      clear: (uuid) => records.delete(uuid),
    },
    withLock(uuid, work) {
      const result = lock.then(work)
      lock = result.catch(() => {})
      return result
    },
    generateRequestId: () => 'request-' + ++requestCount,
    async startVisitSession(requestId, accessToken) {
      calls.push([requestId, accessToken])
      assert.equal(records.get(deviceUuid)?.requestId, requestId)
      return 123
    },
  }
  return { options, calls }
}

test('starts and restores the same visit without issuing a new request', async () => {
  const { options, calls } = fixture()
  const session = createVisitSession(options)

  assert.equal(session.load(deviceUuid), null)
  assert.deepEqual(await session.start(deviceUuid), started)
  assert.deepEqual(createVisitSession(options).load(deviceUuid), started)
  assert.equal(session.load('another-device'), null)
  assert.deepEqual(calls, [['request-1', token]])
})

test('reuses the same pending request after a lost response and reload', async () => {
  const { options, calls } = fixture()
  const send = options.startVisitSession
  let loseResponse = true
  options.startVisitSession = async (...args) => {
    const sessionId = await send(...args)
    if (loseResponse) throw new ApiError('API connection failed')
    return sessionId
  }
  const session = createVisitSession(options)
  await assert.rejects(session.start(deviceUuid), ApiError)
  assert.deepEqual(session.load(deviceUuid), pending)

  loseResponse = false
  const reloaded = createVisitSession(options)
  assert.deepEqual(await reloaded.start(deviceUuid), started)
  assert.deepEqual(calls, [['request-1', token], ['request-1', token]])
})

test('serializes starts in separate tabs and reuses the started visit', async () => {
  const { options, calls } = fixture()
  const firstTab = createVisitSession(options)
  const secondTab = createVisitSession(options)
  const results = await Promise.all([
    firstTab.start(deviceUuid),
    secondTab.start(deviceUuid),
  ])

  assert.deepEqual(results, [started, started])
  assert.deepEqual(calls, [['request-1', token]])
})

test('keeps an existing checkout when a stale start is retried', async () => {
  const { options } = fixture()
  const session = createVisitSession(options)
  await session.start(deviceUuid)
  const activeCheckout = { ...started, checkout: { phase: 'create' } }
  options.storage.save(deviceUuid, activeCheckout)
  assert.deepEqual(await session.start(deviceUuid), activeCheckout)
})

test('refreshes rejected authentication once without changing the request ID', async () => {
  const { options, calls } = fixture()
  const refreshed = { ...token, value: 'refreshed-token' }
  let currentToken = token
  options.auth.getAccessToken = async () => currentToken
  options.auth.invalidateAccessToken = (rejected) => {
    assert.equal(rejected, currentToken)
    currentToken = refreshed
  }
  const send = options.startVisitSession
  options.startVisitSession = async (requestId, accessToken) => {
    const sessionId = await send(requestId, accessToken)
    if (accessToken === token) throw new ApiError('API request failed', 401)
    return sessionId
  }

  assert.deepEqual(await createVisitSession(options).start(deviceUuid), started)
  assert.deepEqual(calls, [['request-1', token], ['request-1', refreshed]])
})

test('does not send a start when storage fails or authentication belongs to another device', async () => {
  const { options, calls } = fixture()
  const save = options.storage.save
  const failure = new Error('Storage write failed')
  options.storage.save = () => { throw failure }
  const session = createVisitSession(options)

  await assert.rejects(session.start(deviceUuid), (error) => error === failure)
  options.storage.save = save
  options.auth.getAccessToken = async () => ({ ...token, deviceUuid: 'another-device' })
  await assert.rejects(session.start(deviceUuid), { status: 401 })
  assert.deepEqual(calls, [])
})

test('keeps the pending request if the result cannot be saved', async () => {
  const { options, calls } = fixture()
  const save = options.storage.save
  options.storage.save = (uuid, record) => {
    if (record.visitSessionId) throw new Error('Storage write failed')
    save(uuid, record)
  }
  const session = createVisitSession(options)

  await assert.rejects(session.start(deviceUuid), /Storage write failed/)
  assert.deepEqual(session.load(deviceUuid), pending)
  options.storage.save = save
  assert.deepEqual(await session.start(deviceUuid), started)
  assert.deepEqual(calls, [['request-1', token], ['request-1', token]])
})

test('clears a rejected request on conflict and creates a fresh request on the next start', async () => {
  const { options, calls } = fixture()
  const send = options.startVisitSession
  let conflict = true
  options.startVisitSession = async (...args) => {
    const sessionId = await send(...args)
    if (conflict) throw new ApiError('API request failed', 409)
    return sessionId
  }
  const session = createVisitSession(options)
  await assert.rejects(session.start(deviceUuid), { status: 409 })
  assert.equal(session.load(deviceUuid), null)
  conflict = false
  assert.deepEqual(await session.start(deviceUuid), {
    requestId: 'request-2', visitSessionId: 123,
  })
  assert.deepEqual(calls, [['request-1', token], ['request-2', token]])
})
