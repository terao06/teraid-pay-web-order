import { ApiError, requestJson } from '../../../components/api/apiClient.js'

export const MENU_CATEGORIES_PATH = '/device/menu/categories'

function isCategory(category) {
  return Number.isSafeInteger(category?.menu_category_id)
    && category.menu_category_id > 0
    && typeof category.name === 'string'
    && typeof category.image_url === 'string'
    && Number.isSafeInteger(category.display_order)
}

export async function getMenuCategories(visitSessionId, token, request = requestJson) {
  const query = new URLSearchParams({ visit_session_id: visitSessionId })
  const data = await request(`${MENU_CATEGORIES_PATH}?${query}`, {
    headers: { Authorization: `${token.type} ${token.value}` },
  })
  if (!Array.isArray(data?.menu_categories) || !data.menu_categories.every(isCategory)) {
    throw new ApiError('Invalid menu categories response')
  }
  return data.menu_categories
}
