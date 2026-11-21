import { MAX_CART_QUANTITY } from './cart.js'

function cartKey(deviceUuid, visitSessionId) {
  return `teraid-pay-cart:${deviceUuid}:${visitSessionId}`
}

function isId(value) {
  return Number.isSafeInteger(value) && value > 0
}

function isAmount(value) {
  return typeof value === 'string' && /^\d+\.\d{6}$/.test(value)
}

function isOption(option) {
  return isId(option?.id)
    && typeof option.name === 'string'
    && typeof option.groupName === 'string'
    && isAmount(option.additionalPrice)
}

function isLine(line) {
  return isId(line?.itemId)
    && typeof line.key === 'string'
    && typeof line.name === 'string'
    && typeof line.tokenSymbol === 'string'
    && isAmount(line.unitPrice)
    && Number.isInteger(line.quantity)
    && line.quantity >= 1
    && line.quantity <= MAX_CART_QUANTITY
    && Array.isArray(line.options)
    && line.options.every(isOption)
}

export function createCartStore(getStorage = () => globalThis.sessionStorage) {
  return {
    load(deviceUuid, visitSessionId) {
      try {
        const raw = getStorage().getItem(cartKey(deviceUuid, visitSessionId))
        if (raw === null) return []
        const lines = JSON.parse(raw)
        if (!Array.isArray(lines) || !lines.every(isLine)) return []
        if (new Set(lines.map(({ key }) => key)).size !== lines.length) return []
        return lines
      } catch {
        return []
      }
    },

    save(deviceUuid, visitSessionId, lines) {
      try {
        const storage = getStorage()
        const key = cartKey(deviceUuid, visitSessionId)
        if (lines.length) storage.setItem(key, JSON.stringify(lines))
        else storage.removeItem(key)
      } catch {
        // The in-memory cart remains usable if browser storage is unavailable.
      }
    },
  }
}

export const cartStore = createCartStore()
