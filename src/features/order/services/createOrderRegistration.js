import { createAuthenticatedDeviceRequest } from '../../device-auth/services/createAuthenticatedDeviceRequest.js'

export function createOrderRegistration({ auth, registerOrder }) {
  const request = createAuthenticatedDeviceRequest(auth)
  return (deviceUuid, visitSessionId, lines, idempotencyKey) => request(deviceUuid,
    (token) => registerOrder(visitSessionId, lines, idempotencyKey, token))
}
