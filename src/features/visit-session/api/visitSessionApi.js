import { ApiError, requestJson } from '../../../components/api/apiClient.js'

export const VISIT_SESSION_START_PATH = '/device/visit-sessions'

export async function startVisitSession(startRequestId, token, request = requestJson) {
  const data = await request(VISIT_SESSION_START_PATH, {
    method: 'POST',
    headers: { Authorization: `${token.type} ${token.value}` },
    body: { start_request_id: startRequestId },
  })
  if (!Number.isSafeInteger(data?.visit_session_id) || data.visit_session_id < 1) {
    throw new ApiError('Invalid visit session response')
  }
  return data.visit_session_id
}
