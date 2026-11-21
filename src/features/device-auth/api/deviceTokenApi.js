import { ApiError, requestJson } from '../../../components/api/apiClient.js'

export const DEVICE_TOKEN_PATH = '/device/auth/token'

export async function requestDeviceToken(registration, request = requestJson) {
  const { device_uuid, device_credential } = registration
  const data = await request(DEVICE_TOKEN_PATH, {
    method: 'POST',
    body: { device_uuid, device_credential },
  })
  if (
    typeof data?.access_token !== 'string' || !data.access_token
    || data.token_type !== 'Bearer'
    || !Number.isSafeInteger(data.expires_in) || data.expires_in < 1
  ) {
    throw new ApiError('Invalid device access token response')
  }
  return data
}
