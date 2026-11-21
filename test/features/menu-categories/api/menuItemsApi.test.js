import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createApiClient } from '../../../../src/components/api/apiClient.js'
import { getMenuItems } from '../../../../src/features/menu-categories/api/menuItemsApi.js'

const token = { type: 'Bearer', value: 'test-token' }
const option = { menu_option_id: 30, name: 'チーズ追加', additional_price: '100.500000', display_order: 1 }
const group = {
  menu_option_group_id: 20,
  name: 'トッピング',
  min_selections: 0,
  max_selections: 2,
  display_order: 1,
  options: [option, { ...option, menu_option_id: 29, display_order: 2 }],
}
const item = {
  menu_item_id: 10,
  name: 'チーズバーガー',
  price: '600.000000',
  token_symbol: 'JPYC',
  image_url: 'https://example.com/menus/10.jpeg?signature=example',
  display_order: 1,
  option_groups: [group, { ...group, menu_option_group_id: 19, display_order: 2, options: [] }],
}

test('requests the selected category for the visit and preserves API order and prices', async () => {
  const items = [item, { ...item, menu_item_id: 9, display_order: 2, option_groups: [] }]
  const request = createApiClient(async (path, options) => {
    assert.equal(path, '/device/menu/categories/7/items?visit_session_id=123')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token')
    assert.equal(options.body, undefined)
    assert.equal(options.cache, 'no-store')
    return Response.json({ menu_items: items })
  })
  assert.deepEqual(await getMenuItems(7, 123, token, request), items)
})

test('accepts a category with no items', async () => {
  assert.deepEqual(await getMenuItems(7, 123, token, async () => ({ menu_items: [] })), [])
})

test('rejects invalid IDs before sending a request', async () => {
  const request = () => assert.fail('Unexpected API request')
  await assert.rejects(getMenuItems('7/items', 123, token, request), TypeError)
  await assert.rejects(getMenuItems(7, 0, token, request), TypeError)
})

test('rejects malformed items and option rules and preserves HTTP error status', async () => {
  const invalidItems = [
    null,
    { ...item, image_url: null },
    { ...item, price: 600 },
    { ...item, option_groups: [{ ...group, min_selections: 3 }] },
    { ...item, option_groups: [{ ...group, options: [{ ...option, additional_price: '100.50' }] }] },
  ]
  await assert.rejects(getMenuItems(7, 123, token, async () => ({})), ApiError)
  for (const invalidItem of invalidItems) {
    await assert.rejects(getMenuItems(7, 123, token, async () => ({ menu_items: [invalidItem] })), ApiError)
  }
  for (const status of [401, 404, 422, 500]) {
    const request = createApiClient(async () => Response.json({}, { status }))
    await assert.rejects(getMenuItems(7, 123, token, request), { status })
  }
})
