import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createApiClient } from '../../../src/components/api/apiClient.js'

test('sends JSON with the shared fetch settings and parses the response', async () => {
  const body = { value: 1 }
  const requestJson = createApiClient(async (path, options) => {
    assert.equal(path, '/example')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.get('Content-Type'), 'application/json')
    assert.equal(options.body, JSON.stringify(body))
    assert.equal(options.cache, 'no-store')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.mode, 'same-origin')
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
    return Response.json({ status: 'success' })
  })

  assert.deepEqual(await requestJson('/example', { method: 'POST', body }), { status: 'success' })
})

test('passes authorization headers and omits a body for a GET request', async () => {
  const requestJson = createApiClient(async (path, options) => {
    assert.equal(path, '/example')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token')
    assert.equal(options.headers.has('Content-Type'), false)
    assert.equal(options.body, undefined)
    return Response.json([])
  })

  assert.deepEqual(await requestJson('/example', { headers: { Authorization: 'Bearer test-token' } }), [])
})

test('preserves HTTP statuses without including the response body in errors', async () => {
  const responseBody = 'private server detail'
  for (const status of [400, 401, 422, 500]) {
    const requestJson = createApiClient(async () => new Response(responseBody, { status }))
    await assert.rejects(requestJson('/example'), (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, status)
      assert.ok(!error.message.includes(responseBody))
      return true
    })
  }
})

test('reports transport failures without a status and malformed JSON with the received status', async () => {
  for (const failure of [new TypeError('Network error'), new DOMException('Timeout', 'TimeoutError')]) {
    const requestJson = createApiClient(async () => { throw failure })
    await assert.rejects(requestJson('/example'), { name: 'ApiError', status: undefined })
  }

  const requestJson = createApiClient(async () => new Response('Invalid JSON', { status: 200 }))
  await assert.rejects(requestJson('/example'), { name: 'ApiError', status: 200 })
})
