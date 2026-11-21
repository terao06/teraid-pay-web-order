import { ApiError } from '../../../components/api/apiClient.js'
import { isPaymentMode } from '../paymentModes.js'

export function createVisitSession({ auth, storage, withLock, generateRequestId, startVisitSession }) {
  async function authenticate(deviceUuid) {
    const token = await auth.getAccessToken()
    if (token?.deviceUuid !== deviceUuid) throw new ApiError('Device authentication required', 401)
    return token
  }

  async function send(deviceUuid, requestId, token) {
    try {
      return await startVisitSession(requestId, token)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) storage.clear(deviceUuid)
      if (error instanceof ApiError && error.status === 401) auth.invalidateAccessToken(token)
      throw error
    }
  }

  async function sendStart(deviceUuid, requestId) {
    const token = await authenticate(deviceUuid)
    try {
      return await send(deviceUuid, requestId, token)
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error
      const refreshedToken = await authenticate(deviceUuid)
      return send(deviceUuid, requestId, refreshedToken)
    }
  }

  function savePaymentMode(deviceUuid, record, paymentMode) {
    const updated = { ...record, paymentMode }
    storage.save(deviceUuid, updated)
    return updated
  }

  return {
    load: storage.load,

    async resetPaymentMode(deviceUuid) {
      return withLock(deviceUuid, () => {
        const record = storage.load(deviceUuid)
        if (!record?.visitSessionId || record.paymentMode === null) return record
        return savePaymentMode(deviceUuid, record, null)
      })
    },

    async start(deviceUuid, paymentMode) {
      if (paymentMode !== undefined && !isPaymentMode(paymentMode)) {
        throw new TypeError('Invalid payment mode')
      }

      return withLock(deviceUuid, async () => {
        let record = storage.load(deviceUuid)
        if (record?.visitSessionId) {
          if (record.paymentMode === null && paymentMode !== undefined) {
            return savePaymentMode(deviceUuid, record, paymentMode)
          }
          return record
        }
        if (record && paymentMode !== undefined && record.paymentMode !== paymentMode) {
          return record
        }

        if (!record) {
          if (paymentMode === undefined) return null
          record = { requestId: generateRequestId(), paymentMode }
          // Retain the same request ID if the API commits before the response arrives.
          storage.save(deviceUuid, record)
        }

        const visitSessionId = await sendStart(deviceUuid, record.requestId)
        const started = { ...record, visitSessionId }
        storage.save(deviceUuid, started)
        return started
      })
    },
  }
}
