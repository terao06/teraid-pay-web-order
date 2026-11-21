import { cartStore } from '../cart/cartStore.js'
import { deviceSession } from '../device-auth/deviceSession.js'
import { completeVisitSession } from '../visit-session/api/visitSessionApi.js'
import { withVisitSessionLock } from '../visit-session/visitSession.js'
import { visitSessionStore } from '../visit-session/visitSessionStore.js'
import { createCheckout, startFacePayment, verifyPayment } from './api/checkoutApi.js'
import { createCheckoutFlow } from './services/createCheckoutFlow.js'

export const checkoutFlow = createCheckoutFlow({
  auth: deviceSession,
  storage: visitSessionStore,
  withLock: withVisitSessionLock,
  generateKey: () => crypto.randomUUID(),
  createCheckout,
  startFacePayment,
  verifyPayment,
  completeVisitSession,
  clearCart: cartStore.clear,
})
