import { deviceSession } from '../device-auth/deviceSession.js'
import { getMenuCategories } from './api/menuCategoriesApi.js'
import { getMenuItems } from './api/menuItemsApi.js'
import { createMenuCategories } from './services/createMenuCategories.js'

export const { loadMenuCategories, loadMenuItems } = createMenuCategories({
  auth: deviceSession,
  getMenuCategories,
  getMenuItems,
})
