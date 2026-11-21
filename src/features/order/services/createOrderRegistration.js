import { ApiError } from '../../../components/api/apiClient.js'

function isUnauthorized(error) {
  return error instanceof ApiError && error.status === 401
}

export function createOrderRegistration({ auth, registerOrder }) {
  async function authenticate(deviceUuid) {
    const token = await auth.getAccessToken()
    if (token?.deviceUuid !== deviceUuid) throw new ApiError('Device authentication required', 401)
    return token
  }

  return async (deviceUuid, visitSessionId, lines, idempotencyKey) => {
    async function send(token) {
      try {
        return await registerOrder(visitSessionId, lines, idempotencyKey, token)
      } catch (error) {
        if (isUnauthorized(error)) auth.invalidateAccessToken(token)
        throw error
      }
    }

    const token = await authenticate(deviceUuid)
    try {
      return await send(token)
    } catch (error) {
      if (!isUnauthorized(error)) throw error
      return send(await authenticate(deviceUuid))
    }
  }
}
