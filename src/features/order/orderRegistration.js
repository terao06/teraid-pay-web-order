import { deviceSession } from '../device-auth/deviceSession.js'
import { registerOrder } from './api/orderApi.js'
import { createOrderRegistration } from './services/createOrderRegistration.js'

export const submitOrder = createOrderRegistration({ auth: deviceSession, registerOrder })
