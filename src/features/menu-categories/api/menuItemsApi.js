import { ApiError, requestJson } from '../../../components/api/apiClient.js'
import { MENU_CATEGORIES_PATH } from './menuCategoriesApi.js'

function isPositiveId(value) {
  return Number.isSafeInteger(value) && value > 0
}

function isMenuAmount(value) {
  return typeof value === 'string' && /^[0-9]{1,14}\.[0-9]{6}$/.test(value)
}

function isMenuOption(option) {
  return isPositiveId(option?.menu_option_id)
    && typeof option.name === 'string'
    && isMenuAmount(option.additional_price)
    && Number.isSafeInteger(option.display_order)
}

function isOptionGroup(group) {
  return isPositiveId(group?.menu_option_group_id)
    && typeof group.name === 'string'
    && Number.isSafeInteger(group.min_selections)
    && group.min_selections >= 0
    && Number.isSafeInteger(group.max_selections)
    && group.max_selections >= Math.max(1, group.min_selections)
    && Number.isSafeInteger(group.display_order)
    && Array.isArray(group.options)
    && group.options.every(isMenuOption)
}

function isMenuItem(item) {
  return isPositiveId(item?.menu_item_id)
    && typeof item.name === 'string'
    && isMenuAmount(item.price)
    && typeof item.token_symbol === 'string'
    && typeof item.image_url === 'string'
    && Number.isSafeInteger(item.display_order)
    && Array.isArray(item.option_groups)
    && item.option_groups.every(isOptionGroup)
}

export async function getMenuItems(categoryId, visitSessionId, token, request = requestJson) {
  if (!isPositiveId(categoryId) || !isPositiveId(visitSessionId)) throw new TypeError('Invalid menu request ID')

  const query = new URLSearchParams({ visit_session_id: visitSessionId })
  const data = await request(`${MENU_CATEGORIES_PATH}/${categoryId}/items?${query}`, {
    headers: { Authorization: `${token.type} ${token.value}` },
  })
  if (!Array.isArray(data?.menu_items) || !data.menu_items.every(isMenuItem)) {
    throw new ApiError('Invalid menu items response')
  }
  return data.menu_items
}
