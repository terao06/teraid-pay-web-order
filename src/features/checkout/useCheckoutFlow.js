import { computed, onUnmounted, ref, watch } from 'vue'
import { ApiError } from '../../components/api/apiClient.js'
import { CartStorageError } from '../cart/cartStore.js'
import { VisitSessionStorageError } from '../visit-session/visitSessionStore.js'
import { checkoutFlow } from './checkoutFlow.js'

const POLL_INTERVAL_MS = 3000
const automaticPhases = new Set(['create', 'verify', 'complete'])

function checkoutError(action, error) {
  if (error instanceof VisitSessionStorageError || error instanceof CartStorageError) {
    return '会計情報を端末に保存できませんでした。店舗スタッフにお声がけください。'
  }
  if (error instanceof ApiError && error.status === 401) {
    return '端末を認証できませんでした。店舗スタッフにお声がけください。'
  }
  if (action === 'create' && error?.status === 409) {
    return '会計を作成できませんでした。未払いの注文、通貨の違い、決済の進行状況をご確認ください。'
  }
  if (action === 'pay' && [400, 404, 422].includes(error?.status)) {
    return '顔認証決済を開始できませんでした。お一人で撮影し、顔の登録とウォレットの設定をご確認ください。'
  }
  if (action === 'verify') return '決済結果を取得できませんでした。同じ決済の結果を確認してください。'
  if (action === 'complete') return 'セッションの終了を確認できませんでした。終了を再試行してください。'
  return '会計の処理結果を確認できませんでした。接続を確認して再試行してください。'
}

export function useCheckoutFlow(deviceUuid, record, restore, flow = checkoutFlow) {
  const activeAction = ref(null)
  const busy = computed(() => activeAction.value !== null)
  const message = ref('')
  const verificationPaused = ref(false)
  const polling = computed(() => record.value?.checkout?.phase === 'verify' && !verificationPaused.value)
  const completedVisit = ref(null)
  let timer
  let disposed = false

  function schedule(action, delay) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (record.value?.checkout?.phase !== action) return
      if (busy.value) schedule(action, POLL_INTERVAL_MS)
      else run(action)
    }, delay)
  }

  async function run(action, input) {
    if (disposed || busy.value || !record.value?.visitSessionId) return
    clearTimeout(timer)
    const { visitSessionId, checkout } = record.value
    activeAction.value = action
    message.value = ''
    if (action === 'verify') verificationPaused.value = false

    let retryVerification = true
    try {
      const result = await flow[action](deviceUuid, visitSessionId, checkout, input)
      if (!disposed && action === 'complete' && result === true) {
        completedVisit.value = visitSessionId
      }
    } catch (error) {
      retryVerification = error instanceof ApiError && (error.status === undefined || error.status >= 500)
      message.value = checkoutError(action, error)
    } finally {
      if (!disposed) restore()
      activeAction.value = null
      if (!disposed && action === 'verify' && record.value?.visitSessionId === visitSessionId
        && record.value.checkout?.phase === 'verify' && record.value.checkout.paymentId === checkout?.paymentId) {
        verificationPaused.value = !retryVerification
        if (retryVerification) schedule('verify', POLL_INTERVAL_MS)
      }
    }
  }

  watch([
    () => record.value?.visitSessionId,
    () => record.value?.checkout?.phase,
    () => record.value?.checkout?.paymentId,
  ], ([, phase]) => {
    clearTimeout(timer)
    verificationPaused.value = false
    if (automaticPhases.has(phase)) schedule(phase, 0)
  }, { immediate: true })

  onUnmounted(() => {
    disposed = true
    clearTimeout(timer)
  })
  return { run, activeAction, busy, message, polling, completedVisit }
}
