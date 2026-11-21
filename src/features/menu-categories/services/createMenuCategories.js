import { ApiError } from '../../../components/api/apiClient.js'

function isUnauthorized(error) {
  return error instanceof ApiError && error.status === 401
}

export function createMenuCategories({ auth, getMenuCategories, getMenuItems }) {
  async function authenticate(deviceUuid) {
    const token = await auth.getAccessToken()
    if (token?.deviceUuid !== deviceUuid) throw new ApiError('Device authentication required', 401)
    return token
  }

  async function send(request, token) {
    try {
      return await request(token)
    } catch (error) {
      if (isUnauthorized(error)) auth.invalidateAccessToken(token)
      throw error
    }
  }

  async function load(deviceUuid, request) {
    const token = await authenticate(deviceUuid)
    try {
      return await send(request, token)
    } catch (error) {
      if (!isUnauthorized(error)) throw error
      return send(request, await authenticate(deviceUuid))
    }
  }

  return {
    loadMenuCategories(deviceUuid, visitSessionId) {
      return load(deviceUuid, (token) => getMenuCategories(visitSessionId, token))
    },
    loadMenuItems(deviceUuid, categoryId, visitSessionId) {
      return load(deviceUuid, (token) => getMenuItems(categoryId, visitSessionId, token))
    },
  }
}
