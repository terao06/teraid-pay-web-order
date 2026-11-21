import {
  deviceRegistrationStore, DeviceRegistrationStorageError,
} from '../../shared/device-registration/deviceRegistrationStore.js'
import { activateDevice } from './api/deviceActivationApi.js'
import { createDeviceSetup } from './services/createDeviceSetup.js'

const ACTIVATION_LOCK = 'teraid-pay-device-registration'

export function supportsDeviceActivation() {
  return typeof globalThis.navigator?.locks?.request === 'function'
}

function withActivationLock(work) {
  if (!supportsDeviceActivation()) throw new DeviceRegistrationStorageError()
  return navigator.locks.request(ACTIVATION_LOCK, work)
}

export const deviceSetup = createDeviceSetup({
  activateDevice,
  storage: deviceRegistrationStore,
  withActivationLock,
})
