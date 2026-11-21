export function isDeviceRegistration(data) {
  return typeof data?.device_uuid === 'string'
    && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.device_uuid)
    && typeof data.device_credential === 'string'
    && data.device_credential.length > 0
}
