import { ApiError, requestJson } from '../../../components/api/apiClient.js'
import { VISIT_SESSION_START_PATH } from '../../visit-session/api/visitSessionApi.js'
import { isCheckoutSummary, isPaymentResult, isPaymentStarted } from '../checkoutState.js'

export const CHECKOUTS_PATH = '/device/checkouts'
export const CHECKOUT_PATH_SUFFIX = '/checkouts'
export const FACE_PAYMENT_PATH_SUFFIX = '/payments/face'
export const PAYMENT_VERIFICATION_PATH_SUFFIX = '/verify'

export async function createCheckout(visitSessionId, token, request = requestJson) {
  const data = await request(`${VISIT_SESSION_START_PATH}/${visitSessionId}${CHECKOUT_PATH_SUFFIX}`, {
    method: 'POST',
    headers: { Authorization: `${token.type} ${token.value}` },
    body: { scope: 'all_unpaid' },
  })
  if (!isCheckoutSummary(data)) {
    throw new ApiError('Invalid checkout response')
  }
  return data
}

export async function startFacePayment(checkoutId, key, content, token, request = requestJson) {
  const data = await request(`${CHECKOUTS_PATH}/${checkoutId}${FACE_PAYMENT_PATH_SUFFIX}`, {
    method: 'POST',
    headers: { Authorization: `${token.type} ${token.value}`, 'Idempotency-Key': key },
    body: { content },
  })
  if (!isPaymentStarted(data)) throw new ApiError('Invalid payment start response')
  return data
}

export async function verifyPayment(checkoutId, paymentId, token, request = requestJson) {
  const data = await request(`${CHECKOUTS_PATH}/${checkoutId}/payments/${paymentId}${PAYMENT_VERIFICATION_PATH_SUFFIX}`, {
    method: 'POST',
    headers: { Authorization: `${token.type} ${token.value}` },
  })
  if (!isPaymentResult(data, paymentId)) throw new ApiError('Invalid payment result response')
  return data
}
