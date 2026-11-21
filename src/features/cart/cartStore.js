import { isOrderReceipt } from '../order/orderReceipt.js'
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

function isCart(lines) {
  return Array.isArray(lines) && lines.every(isLine)
    && new Set(lines.map(({ key }) => key)).size === lines.length
}

export class CartStorageError extends Error {
  constructor() {
    super('Cart storage unavailable')
    this.name = 'CartStorageError'
  }
}

export function createCartStore(getStorage = () => globalThis.sessionStorage) {
  return {
    clear(deviceUuid, visitSessionId) {
      try {
        getStorage().removeItem(cartKey(deviceUuid, visitSessionId))
      } catch {
        throw new CartStorageError()
      }
    },

    load(deviceUuid, visitSessionId) {
      let raw
      try {
        raw = JSON.parse(getStorage().getItem(cartKey(deviceUuid, visitSessionId)))
      } catch {
        return { lines: [], pendingKey: null, receipt: null }
      }

      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const { lines, pendingKey, receipt } = raw
        // Preserve a pending order until the API has confirmed its outcome.
        const hasPendingOrder = lines?.length > 0 && receipt === null
          && typeof pendingKey === 'string' && pendingKey.length <= 64 && pendingKey.trim()
        const hasReceipt = lines?.length === 0 && pendingKey === null && isOrderReceipt(receipt)
        if (isCart(lines) && (hasPendingOrder || hasReceipt)) return { lines, pendingKey, receipt }
        throw new CartStorageError()
      }

      return { lines: isCart(raw) ? raw : [], pendingKey: null, receipt: null }
    },

    save(deviceUuid, visitSessionId, { lines, pendingKey, receipt }) {
      try {
        const storage = getStorage()
        const key = cartKey(deviceUuid, visitSessionId)
        if (pendingKey || receipt) storage.setItem(key, JSON.stringify({ lines, pendingKey, receipt }))
        else if (lines.length) storage.setItem(key, JSON.stringify(lines))
        else storage.removeItem(key)
      } catch {
        throw new CartStorageError()
      }
    },
  }
}

export const cartStore = createCartStore()
