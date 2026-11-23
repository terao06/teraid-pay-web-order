import { computed, ref, toValue } from 'vue'
import { ApiError } from '../../components/api/apiClient.js'
import { submitOrder } from '../order/orderRegistration.js'
import { cartStore, CartStorageError } from './cartStore.js'

const storageMessage = '注文情報を端末に保存できませんでした。店舗スタッフにお声がけください。'
const requestErrors = {
  401: '端末を認証できませんでした。店舗スタッフにお声がけください。',
  404: 'この来店セッションでは現在注文を受け付けていません。店舗スタッフにお声がけください。',
  409: '注文情報が一致しませんでした。店舗スタッフにお声がけください。',
}
const invalidCartMessage = '注文内容を受け付けられませんでした。商品やオプション、数量をご確認ください。'

export function useCartOrder(deviceUuid, visitSessionId, {
  storage = cartStore,
  sendOrder = submitOrder,
  generateKey = () => crypto.randomUUID(),
  paidOrderIds = [],
  allowAdditionalOrder = false,
} = {}) {
  const cart = ref({ lines: [], pendingKey: null, receipt: null })
  const storageBlocked = ref(false)
  const sending = ref(false)
  const orderError = ref('')

  try {
    cart.value = storage.load(deviceUuid, visitSessionId)
    if (cart.value.receipt && paidOrderIds.includes(cart.value.receipt.menu_order_id)) {
      storage.clear(deviceUuid, visitSessionId)
      cart.value = { lines: [], pendingKey: null, receipt: null }
    }
  } catch {
    storageBlocked.value = true
    orderError.value = '注文情報を読み込めませんでした。店舗スタッフにお声がけください。'
  }

  const lines = computed(() => cart.value.lines)
  const pending = computed(() => Boolean(cart.value.pendingKey))
  const receipt = computed(() => cart.value.receipt)
  const locked = computed(() => storageBlocked.value || sending.value || pending.value
    || (Boolean(receipt.value) && !toValue(allowAdditionalOrder)))
  const mixedTokens = computed(() => new Set(lines.value.map(({ tokenSymbol }) => tokenSymbol)).size > 1)

  function save(nextCart) {
    storage.save(deviceUuid, visitSessionId, nextCart)
    cart.value = nextCart
  }

  function changeLines(updatedLines) {
    if (locked.value) return
    const nextCart = { ...cart.value, lines: updatedLines, receipt: null }
    try {
      save(nextCart)
    } catch {
      // Allow editing in memory. Submission still requires saving the key and lines together.
      cart.value = nextCart
    }
    orderError.value = ''
  }

  async function confirm() {
    if (storageBlocked.value || sending.value || receipt.value || !lines.value.length || mixedTokens.value) return
    const retrying = pending.value
    orderError.value = ''
    sending.value = true
    try {
      if (!retrying) {
        save({ ...cart.value, pendingKey: generateKey() })
      }
      const result = await sendOrder(deviceUuid, visitSessionId, lines.value, cart.value.pendingKey)
      save({ lines: [], pendingKey: null, receipt: result })
      return result
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && !retrying) {
        try {
          save({ ...cart.value, pendingKey: null })
          orderError.value = invalidCartMessage
        } catch {
          orderError.value = storageMessage
        }
      } else if (error instanceof CartStorageError) {
        orderError.value = storageMessage
      } else if (error instanceof ApiError && error.status === 422) {
        orderError.value = '前回の注文結果を確認できませんでした。店舗スタッフにお声がけください。'
      } else {
        const message = error instanceof ApiError ? requestErrors[error.status] : undefined
        orderError.value = message ?? '注文結果を確認できませんでした。同じ内容で再試行してください。'
      }
    } finally {
      sending.value = false
    }
  }

  return { lines, pending, receipt, locked, mixedTokens, sending, orderError, changeLines, confirm }
}
