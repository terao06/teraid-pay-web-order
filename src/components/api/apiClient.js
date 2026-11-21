const REQUEST_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function createApiClient(fetchRequest = globalThis.fetch) {
  return async function requestJson(path, { method = 'GET', headers, body } = {}) {
    const requestHeaders = new Headers(headers)
    if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')

    let response
    try {
      response = await fetchRequest(path, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit',
        mode: 'same-origin',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw new ApiError('API connection failed')
    }

    if (!response.ok) throw new ApiError('API request failed', response.status)

    try {
      return await response.json()
    } catch {
      throw new ApiError('API returned invalid JSON', response.status)
    }
  }
}

export const requestJson = createApiClient()
