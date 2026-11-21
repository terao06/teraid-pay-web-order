import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createApiClient } from '../../../../src/components/api/apiClient.js'
import { getMenuCategories } from '../../../../src/features/menu-categories/api/menuCategoriesApi.js'

const token = { type: 'Bearer', value: 'test-token' }
const category = {
  menu_category_id: 7,
  name: 'ハンバーガー',
  image_url: 'https://example.com/categories/7.jpeg?signature=example',
  display_order: 1,
}

test('requests categories for the visit session and keeps the API display order', async () => {
  const menuCategories = [category, { ...category, menu_category_id: 3, display_order: 2 }]
  const request = createApiClient(async (path, options) => {
    assert.equal(path, '/device/menu/categories?visit_session_id=123')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token')
    assert.equal(options.body, undefined)
    assert.equal(options.cache, 'no-store')
    return Response.json({ menu_categories: menuCategories })
  })

  assert.deepEqual(await getMenuCategories(123, token, request), menuCategories)
})

test('accepts an empty category list', async () => {
  assert.deepEqual(await getMenuCategories(123, token, async () => ({ menu_categories: [] })), [])
})

test('rejects malformed responses and preserves API error statuses', async () => {
  for (const response of [
    {},
    { menu_categories: {} },
    { menu_categories: [null] },
    { menu_categories: [{ ...category, menu_category_id: 0 }] },
    { menu_categories: [{ ...category, name: null }] },
    { menu_categories: [{ ...category, image_url: null }] },
    { menu_categories: [{ ...category, display_order: '1' }] },
  ]) {
    await assert.rejects(getMenuCategories(123, token, async () => response), ApiError)
  }

  for (const status of [401, 404, 422, 500]) {
    const request = createApiClient(async () => Response.json({}, { status }))
    await assert.rejects(getMenuCategories(123, token, request), { status })
  }
})
