<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ApiError } from '../../components/api/apiClient.js'
import ToastMessage from '../../components/feedback/ToastMessage.vue'
import CheckoutPage from '../checkout/CheckoutPage.vue'
import { isCheckoutDeferred } from '../checkout/checkoutState.js'
import { useCheckoutFlow } from '../checkout/useCheckoutFlow.js'
import MenuCategoriesPage from '../menu-categories/MenuCategoriesPage.vue'
import { visitSession } from './visitSession.js'
import { visitSessionStorageKey, VisitSessionStorageError } from './visitSessionStore.js'

const props = defineProps({
  deviceUuid: { type: String, required: true },
})

const titles = {
  welcome: '注文を開始',
  pending: '注文を開始',
  unavailable: '注文端末の状態を確認してください',
}
const storageMessage = '注文開始の情報を端末に保存または読み込みできません。店舗スタッフにお声がけください。'
const requestErrors = {
  401: '端末を認証できませんでした。店舗スタッフにお声がけください。',
  409: 'この端末で別の来店セッションが進行中か、前回のセッションが終了しています。店舗スタッフにお声がけください。',
  422: '注文開始のリクエストを受け付けられませんでした。店舗スタッフにお声がけください。',
}

const record = ref(null)
const storageUnavailable = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const heading = ref(null)
const completionToast = ref(null)

const checkoutDeferred = computed(() => isCheckoutDeferred(record.value?.checkout?.phase))
const screen = computed(() => {
  if (storageUnavailable.value) return 'unavailable'
  if (record.value?.checkout && !checkoutDeferred.value) return 'checkout'
  if (record.value?.visitSessionId) return 'started'
  return record.value ? 'pending' : 'welcome'
})

function restore() {
  try {
    record.value = visitSession.load(props.deviceUuid)
    storageUnavailable.value = false
  } catch {
    storageUnavailable.value = true
    errorMessage.value = storageMessage
  }
}

function retryStorage() {
  errorMessage.value = ''
  restore()
}

async function start() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    record.value = await visitSession.start(props.deviceUuid)
  } catch (error) {
    if (error instanceof VisitSessionStorageError) {
      errorMessage.value = storageMessage
    } else {
      const message = error instanceof ApiError ? requestErrors[error.status] : undefined
      errorMessage.value = message ?? '注文を開始できませんでした。接続を確認して再試行してください。'
    }
    restore()
  } finally {
    busy.value = false
  }
}

function focusHeading() {
  heading.value?.focus()
}

function syncSession(event) {
  if (event.key === null || event.key === visitSessionStorageKey(props.deviceUuid)) restore()
}

restore()
const {
  run: runCheckout, activeAction: checkoutAction, busy: checkoutBusy, message: checkoutMessage,
  polling, completedVisit,
} = useCheckoutFlow(props.deviceUuid, record, restore)
watch(completedVisit, () => {
  completionToast.value?.show('ご利用ありがとうございました。またのお越しをお待ちしております。')
}, { flush: 'post' })
onMounted(() => {
  focusHeading()
  window.addEventListener('storage', syncSession)
})
onUnmounted(() => window.removeEventListener('storage', syncSession))
watch(screen, focusHeading, { flush: 'post' })
</script>

<template>
  <CheckoutPage
    v-if="screen === 'checkout'"
    :key="record.visitSessionId"
    :checkout="record.checkout"
    :busy="checkoutBusy"
    :polling="polling"
    :starting-payment="checkoutAction === 'pay'"
    :message="checkoutMessage"
    @action="runCheckout"
  />
  <MenuCategoriesPage
    v-else-if="screen === 'started'"
    :key="record.visitSessionId"
    :device-uuid="deviceUuid"
    :visit-session-id="record.visitSessionId"
    :paid-order-ids="record.paidOrderIds"
    :deferred-checkout="checkoutDeferred ? record.checkout : null"
    :returning="busy || checkoutBusy"
    :return-error="errorMessage || checkoutMessage"
    @confirm-order="runCheckout('order', $event)"
    @checkout="runCheckout('begin')"
    @finish="runCheckout('finish')"
  />
  <section v-else class="visit-panel" aria-labelledby="visit-title">
    <h1 id="visit-title" ref="heading" tabindex="-1">{{ titles[screen] }}</h1>

    <p v-if="screen === 'welcome'" class="visit-description">この端末からお食事をご注文いただけます。</p>

    <p v-if="errorMessage" class="status-message status-message--error" role="alert">{{ errorMessage }}</p>
    <p v-if="busy" class="status-message" role="status">注文を開始しています。</p>

    <div v-if="screen === 'welcome'" class="visit-actions">
      <button class="button button--primary" type="button" :disabled="busy" @click="start">注文する</button>
    </div>

    <div v-else-if="screen === 'pending'" class="visit-actions">
      <button class="button button--primary" type="button" :disabled="busy" @click="start">再試行</button>
    </div>

    <div v-else-if="screen === 'unavailable'" class="visit-actions">
      <button class="button button--primary" type="button" @click="retryStorage">再試行</button>
    </div>
  </section>
  <ToastMessage ref="completionToast" />
</template>

<style scoped>
.visit-panel {
  inline-size: min(100%, 39rem);
  margin-inline: auto;
  padding: clamp(1.4rem, 6vw, 3.4rem);
  border: 1px solid var(--color-panel-border);
  border-radius: 1.25rem;
  background: var(--color-surface);
  text-align: center;
}

h1 {
  margin: 0;
  font-size: clamp(1.45rem, 3.6vw, 2.15rem);
  line-height: 1.3;
}

.visit-description {
  margin: .8rem 0 0;
  color: var(--color-text-secondary);
}

.visit-panel .status-message--error {
  margin-block-start: 1.25rem;
  text-align: start;
}

.visit-actions {
  display: grid;
  gap: .9rem;
  margin-block-start: 1.5rem;
}
</style>
