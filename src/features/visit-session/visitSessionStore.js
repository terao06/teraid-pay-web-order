import { isPaymentMode } from './paymentModes.js'

const KEY_PREFIX = 'teraid-pay-visit-session:'
const REQUEST_ID_LENGTH = 64

export class VisitSessionStorageError extends Error {
  constructor() {
    super('Visit session storage unavailable')
    this.name = 'VisitSessionStorageError'
  }
}

function withStorage(deviceUuid, work) {
  try {
    return work(globalThis.localStorage, KEY_PREFIX + deviceUuid)
  } catch {
    throw new VisitSessionStorageError()
  }
}

export const visitSessionStore = {
  load(deviceUuid) {
    return withStorage(deviceUuid, (storage, key) => {
      const value = storage.getItem(key)
      if (value === null) return null

      const record = JSON.parse(value)
      const hasSessionId = record?.visitSessionId !== undefined
      const validPaymentMode = isPaymentMode(record?.paymentMode)
        || (hasSessionId && record.paymentMode === null)
      if (
        typeof record?.requestId !== 'string'
        || !record.requestId.trim()
        || record.requestId.length > REQUEST_ID_LENGTH
        || !validPaymentMode
        || (hasSessionId && (!Number.isSafeInteger(record.visitSessionId) || record.visitSessionId < 1))
      ) {
        throw new VisitSessionStorageError()
      }
      return record
    })
  },

  save(deviceUuid, record) {
    withStorage(deviceUuid, (storage, key) => storage.setItem(key, JSON.stringify(record)))
  },

  clear(deviceUuid) {
    withStorage(deviceUuid, (storage, key) => storage.removeItem(key))
  },
}
