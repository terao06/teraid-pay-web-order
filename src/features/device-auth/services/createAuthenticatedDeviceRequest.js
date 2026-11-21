import { ApiError } from '../../../components/api/apiClient.js'

export function createAuthenticatedDeviceRequest(auth) {
  async function authenticate(deviceUuid) {
    const token = await auth.getAccessToken()
    if (token?.deviceUuid !== deviceUuid) throw new ApiError('Device authentication required', 401)
    return token
  }

  async function send(token, request) {
    try {
      return await request(token)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) auth.invalidateAccessToken(token)
      throw error
    }
  }

  return async (deviceUuid, request) => {
    const token = await authenticate(deviceUuid)
    try {
      return await send(token, request)
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error
      return send(await authenticate(deviceUuid), request)
    }
  }
}
