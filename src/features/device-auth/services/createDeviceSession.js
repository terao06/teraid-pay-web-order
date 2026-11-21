const MAX_TOKEN_REFRESH_LEAD_MS = 30_000
const TOKEN_REFRESH_LEAD_RATIO = 0.1

export function createDeviceSession({ loadRegistration, requestDeviceToken, now = Date.now }) {
  let token
  let issuingToken

  function hasFreshToken() {
    return token && now() < token.refreshAt
  }

  async function issueToken(registration) {
    const result = await requestDeviceToken(registration)
    const lifetime = result.expires_in * 1000
    const expiresAt = now() + lifetime
    token = {
      value: result.access_token,
      type: result.token_type,
      deviceUuid: registration.device_uuid,
      expiresAt,
      refreshAt: expiresAt - Math.min(MAX_TOKEN_REFRESH_LEAD_MS, lifetime * TOKEN_REFRESH_LEAD_RATIO),
    }
    return token
  }

  return {
    invalidateAccessToken(rejectedToken) {
      if (token === rejectedToken) token = undefined
    },

    async getAccessToken() {
      if (hasFreshToken()) return token

      const registration = await loadRegistration()
      if (!registration) return null

      // Another caller may have finished issuing a token during the storage read.
      if (hasFreshToken()) return token

      token = undefined
      issuingToken ??= issueToken(registration).finally(() => { issuingToken = undefined })
      return issuingToken
    },
  }
}
