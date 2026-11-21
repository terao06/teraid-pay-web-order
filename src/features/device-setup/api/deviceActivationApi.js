import { ApiError, requestJson } from '../../../components/api/apiClient.js'
import { isDeviceRegistration } from '../../../shared/device-registration/registration.js'

export const DEVICE_ACTIVATION_PATH = '/device/activate'

export async function activateDevice(code, request = requestJson) {
  const data = await request(DEVICE_ACTIVATION_PATH, {
    method: 'POST',
    body: { activation_code: code },
  })
  if (!isDeviceRegistration(data)) throw new ApiError('Invalid device activation response')
  return { device_uuid: data.device_uuid, device_credential: data.device_credential }
}
