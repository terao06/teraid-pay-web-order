import { deviceSession } from '../device-auth/deviceSession.js'
import { startVisitSession } from './api/visitSessionApi.js'
import { createVisitSession } from './services/createVisitSession.js'
import { visitSessionStore, VisitSessionStorageError } from './visitSessionStore.js'

export const visitSession = createVisitSession({
  auth: deviceSession,
  storage: visitSessionStore,
  withLock(deviceUuid, work) {
    if (typeof globalThis.navigator?.locks?.request !== 'function') {
      throw new VisitSessionStorageError()
    }
    return navigator.locks.request('teraid-pay-visit-session:' + deviceUuid, work)
  },
  generateRequestId: () => crypto.randomUUID(),
  startVisitSession,
})
