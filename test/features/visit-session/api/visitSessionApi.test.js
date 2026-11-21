import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createApiClient } from '../../../../src/components/api/apiClient.js'
import { completeVisitSession, startVisitSession } from '../../../../src/features/visit-session/api/visitSessionApi.js'

const token = { type: 'Bearer', value: 'test-token' }
const requestId = 'test-start-request'

test('posts completion without a body and only accepts a closed response for the current visit', async () => {
  await completeVisitSession(123, token, async (path, options) => {
    assert.equal(path, '/device/visit-sessions/123/complete')
    assert.deepEqual(options, { method: 'POST', headers: { Authorization: 'Bearer test-token' } })
    return { visit_session_id: 123, status: 'closed' }
  })
  await assert.rejects(completeVisitSession(123, token, async () => ({ visit_session_id: 1, status: 'closed' })), ApiError)
  await assert.rejects(completeVisitSession(123, token, async () => ({ visit_session_id: 123, status: 'active' })), ApiError)
})

test('sends only the request ID and bearer authorization for both successful statuses', async () => {
  for (const status of [200, 201]) {
    const request = createApiClient(async (path, options) => {
      assert.equal(path, '/device/visit-sessions')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.get('Authorization'), 'Bearer test-token')
      assert.deepEqual(JSON.parse(options.body), { start_request_id: requestId })
      return Response.json({ visit_session_id: 123 }, { status })
    })
    assert.equal(await startVisitSession(requestId, token, request), 123)
  }
})

test('rejects invalid identifiers and preserves the HTTP status of rejected requests', async () => {
  for (const response of [{}, { visit_session_id: '123' }, { visit_session_id: 0 }]) {
    await assert.rejects(startVisitSession(requestId, token, async () => response), ApiError)
  }

  for (const status of [401, 409, 422, 500]) {
    const request = createApiClient(async () => Response.json({}, { status }))
    await assert.rejects(startVisitSession(requestId, token, request), { status })
  }
})
