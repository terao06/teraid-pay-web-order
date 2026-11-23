import { deviceSession } from '../device-auth/deviceSession.js'
import { getOrderHistory } from './api/orderApi.js'
import { createOrderHistory } from './services/createOrderHistory.js'

export const loadOrderHistory = createOrderHistory({ auth: deviceSession, getOrderHistory })
