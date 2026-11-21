import { ApiError } from '../../../components/api/apiClient.js'

function isUnauthorized(error) {
  return error instanceof ApiError && error.status === 401
}

export function createMenuCategories({ auth, getMenuCategories }) {
  async function authenticate(deviceUuid) {
    const token = await auth.getAccessToken()
    if (token?.deviceUuid !== deviceUuid) throw new ApiError('Device authentication required', 401)
    return token
  }

  async function fetchCategories(visitSessionId, token) {
    try {
      return await getMenuCategories(visitSessionId, token)
    } catch (error) {
      if (isUnauthorized(error)) auth.invalidateAccessToken(token)
      throw error
    }
  }

  return async function loadMenuCategories(deviceUuid, visitSessionId) {
    const token = await authenticate(deviceUuid)
    try {
      return await fetchCategories(visitSessionId, token)
    } catch (error) {
      if (!isUnauthorized(error)) throw error
      return fetchCategories(visitSessionId, await authenticate(deviceUuid))
    }
  }
}
