import { deviceRegistrationStore } from '../../shared/device-registration/deviceRegistrationStore.js'
import { requestDeviceToken } from './api/deviceTokenApi.js'
import { createDeviceSession } from './services/createDeviceSession.js'

export const deviceSession = createDeviceSession({
  loadRegistration: deviceRegistrationStore.load,
  requestDeviceToken,
})
