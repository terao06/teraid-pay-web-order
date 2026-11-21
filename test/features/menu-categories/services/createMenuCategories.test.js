import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../../../../src/components/api/apiClient.js'
import { createMenuCategories } from '../../../../src/features/menu-categories/services/createMenuCategories.js'

const deviceUuid = 'device-uuid'
const token = { deviceUuid, value: 'original-token' }
const refreshedToken = { deviceUuid, value: 'refreshed-token' }

test('uses the authenticated device token and returns the category list', async () => {
  const categories = [{ menu_category_id: 1 }]
  const { loadMenuCategories } = createMenuCategories({
    auth: { getAccessToken: async () => token },
    async getMenuCategories(sessionId, accessToken) {
      assert.equal(sessionId, 123)
      assert.equal(accessToken, token)
      return categories
    },
  })
  assert.equal(await loadMenuCategories(deviceUuid, 123), categories)
})

test('does not request categories without a token for the current device', async () => {
  for (const accessToken of [null, { deviceUuid: 'other-device' }]) {
    const { loadMenuCategories } = createMenuCategories({
      auth: { getAccessToken: async () => accessToken },
      getMenuCategories: () => assert.fail('Unexpected API request'),
    })
    await assert.rejects(loadMenuCategories(deviceUuid, 123), { status: 401 })
  }
})

test('refreshes a rejected token and retries the same visit session only once', async () => {
  for (const rejectRefreshedToken of [false, true]) {
    const issuedTokens = [token, refreshedToken]
    const requestedTokens = []
    const invalidatedTokens = []
    const { loadMenuCategories } = createMenuCategories({
      auth: {
        getAccessToken: async () => issuedTokens.shift(),
        invalidateAccessToken: (accessToken) => invalidatedTokens.push(accessToken),
      },
      async getMenuCategories(sessionId, accessToken) {
        assert.equal(sessionId, 123)
        requestedTokens.push(accessToken)
        if (accessToken === token || rejectRefreshedToken) throw new ApiError('Unauthorized', 401)
        return []
      },
    })

    if (rejectRefreshedToken) await assert.rejects(loadMenuCategories(deviceUuid, 123), { status: 401 })
    else assert.deepEqual(await loadMenuCategories(deviceUuid, 123), [])
    assert.deepEqual(requestedTokens, [token, refreshedToken])
    assert.deepEqual(invalidatedTokens, rejectRefreshedToken ? [token, refreshedToken] : [token])
  }
})

test('surfaces non-authentication errors without reissuing a token', async () => {
  for (const status of [404, 422, 500]) {
    let tokenRequests = 0
    const { loadMenuCategories } = createMenuCategories({
      auth: {
        async getAccessToken() {
          tokenRequests += 1
          return token
        },
        invalidateAccessToken: () => assert.fail('Unexpected token invalidation'),
      },
      async getMenuCategories() {
        throw new ApiError('Request failed', status)
      },
    })

    await assert.rejects(loadMenuCategories(deviceUuid, 123), { status })
    assert.equal(tokenRequests, 1)
  }
})

test('refreshes authentication for items without changing the category or visit session', async () => {
  const issuedTokens = [token, refreshedToken]
  const invalidated = []
  const requests = []
  const items = [{ menu_item_id: 10 }]
  const { loadMenuItems } = createMenuCategories({
    auth: {
      getAccessToken: async () => issuedTokens.shift(),
      invalidateAccessToken: (accessToken) => invalidated.push(accessToken),
    },
    async getMenuItems(categoryId, visitSessionId, accessToken) {
      requests.push([categoryId, visitSessionId, accessToken])
      if (accessToken === token) throw new ApiError('Unauthorized', 401)
      return items
    },
  })

  assert.equal(await loadMenuItems(deviceUuid, 7, 123), items)
  assert.deepEqual(requests, [[7, 123, token], [7, 123, refreshedToken]])
  assert.deepEqual(invalidated, [token])
})
