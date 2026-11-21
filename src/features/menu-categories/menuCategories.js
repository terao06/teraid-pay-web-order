import { deviceSession } from '../device-auth/deviceSession.js'
import { getMenuCategories } from './api/menuCategoriesApi.js'
import { createMenuCategories } from './services/createMenuCategories.js'

export const loadMenuCategories = createMenuCategories({ auth: deviceSession, getMenuCategories })
