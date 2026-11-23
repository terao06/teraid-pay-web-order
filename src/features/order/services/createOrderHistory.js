import { createAuthenticatedDeviceRequest } from '../../device-auth/services/createAuthenticatedDeviceRequest.js'

export function createOrderHistory({ auth, getOrderHistory }) {
  const request = createAuthenticatedDeviceRequest(auth)
  return (deviceUuid, visitSessionId) => request(deviceUuid, (token) => getOrderHistory(visitSessionId, token))
}
