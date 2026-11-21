export const ACTIVATION_CODE_EXAMPLE = 'ABCD-EFGH-JKLM'

const QR_TYPE = 'teraid_pay_device_activation'
const QR_VERSION = 1
const activationCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/i

export function formatActivationCode(input) {
  const compact = input.trim().replace(/[\s-]/g, '')
  if (!activationCodePattern.test(compact)) return null

  return compact.toUpperCase().match(/.{4}/g).join('-')
}

export function readActivationQr(payload) {
  try {
    const data = JSON.parse(payload)
    if (data?.type !== QR_TYPE || data.version !== QR_VERSION) return null
    if (typeof data.activation_code !== 'string') return null
    return formatActivationCode(data.activation_code)
  } catch {
    return null
  }
}
