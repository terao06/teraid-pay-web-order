<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ApiError } from '../../components/api/apiClient.js'
import MenuCategoriesPage from '../menu-categories/MenuCategoriesPage.vue'
import { PAYMENT_MODE_LABELS } from './paymentModes.js'
import { visitSession } from './visitSession.js'
import { VisitSessionStorageError } from './visitSessionStore.js'

const props = defineProps({
  deviceUuid: { type: String, required: true },
})

const titles = {
  welcome: '注文を開始',
  select: 'お支払い方法を選択',
  pending: '注文を開始',
  unavailable: '注文端末の状態を確認してください',
}
const paymentDescriptions = {
  combined: 'すべてのご注文をまとめてお支払い',
  per_order: 'ご注文のたびにお支払い',
}
const storageMessage = '注文開始の情報を端末に保存または読み込みできません。店舗スタッフにお声がけください。'
const requestErrors = {
  401: '端末を認証できませんでした。店舗スタッフにお声がけください。',
  409: 'この端末で別の来店セッションが進行中か、前回のセッションが終了しています。店舗スタッフにお声がけください。',
  422: '注文開始のリクエストを受け付けられませんでした。店舗スタッフにお声がけください。',
}

const record = ref(null)
const storageUnavailable = ref(false)
const choosing = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const heading = ref(null)

const sessionStarted = computed(() => Boolean(record.value?.visitSessionId))
const screen = computed(() => {
  if (storageUnavailable.value) return 'unavailable'
  if (sessionStarted.value && record.value.paymentMode) return 'started'
  if (record.value && !sessionStarted.value) return 'pending'
  return choosing.value ? 'select' : 'welcome'
})

function restore() {
  try {
    record.value = visitSession.load(props.deviceUuid)
    if (record.value?.paymentMode === null) choosing.value = true
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

function closePaymentSelection() {
  choosing.value = false
  errorMessage.value = ''
}

async function resetPaymentMode() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    record.value = await visitSession.resetPaymentMode(props.deviceUuid)
    choosing.value = true
  } catch {
    errorMessage.value = storageMessage
  } finally {
    busy.value = false
  }
}

async function start(paymentMode) {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    record.value = await visitSession.start(props.deviceUuid, paymentMode)
  } catch (error) {
    if (error instanceof VisitSessionStorageError) {
      errorMessage.value = storageMessage
    } else {
      const message = error instanceof ApiError ? requestErrors[error.status] : undefined
      errorMessage.value = message ?? '注文を開始できませんでした。接続を確認して再試行してください。'
    }
    restore()
  } finally {
    if (screen.value === 'started') closePaymentSelection()
    busy.value = false
  }
}

function focusHeading() {
  heading.value?.focus()
}

restore()
onMounted(focusHeading)
watch(screen, focusHeading, { flush: 'post' })
</script>

<template>
  <MenuCategoriesPage
    v-if="screen === 'started'"
    :key="record.visitSessionId"
    :device-uuid="deviceUuid"
    :visit-session-id="record.visitSessionId"
    :payment-mode="record.paymentMode"
    :returning="busy"
    :return-error="errorMessage"
    @return-to-payment="resetPaymentMode"
  />
  <section v-else class="visit-panel" aria-labelledby="visit-title">
    <h1 id="visit-title" ref="heading" tabindex="-1">{{ titles[screen] }}</h1>

    <p v-if="screen === 'welcome'" class="visit-description">この端末からお食事をご注文いただけます。</p>

    <p v-if="record?.paymentMode && !storageUnavailable" class="visit-description">
      お支払い方法 <strong>{{ PAYMENT_MODE_LABELS[record.paymentMode] }}</strong>
    </p>

    <p v-if="errorMessage" class="status-message status-message--error" role="alert">{{ errorMessage }}</p>
    <p v-if="busy" class="status-message" role="status">
      {{ sessionStarted ? 'お支払い方法を保存しています。' : '注文を開始しています。' }}
    </p>

    <div v-if="screen === 'welcome'" class="visit-actions">
      <button class="button button--primary" type="button" @click="choosing = true">注文する</button>
    </div>

    <div v-else-if="screen === 'select'" class="visit-actions">
      <div class="payment-options">
        <button
          v-for="(label, mode) in PAYMENT_MODE_LABELS"
          :key="mode"
          class="button button--secondary payment-option"
          type="button"
          :disabled="busy"
          @click="start(mode)"
        >
          <span>{{ label }}</span>
          <small>{{ paymentDescriptions[mode] }}</small>
        </button>
      </div>
      <button class="button button--secondary" type="button" :disabled="busy" @click="closePaymentSelection">
        戻る
      </button>
    </div>

    <div v-else-if="screen === 'pending'" class="visit-actions">
      <button class="button button--primary" type="button" :disabled="busy" @click="start()">再試行</button>
    </div>

    <div v-else-if="screen === 'unavailable'" class="visit-actions">
      <button class="button button--primary" type="button" @click="retryStorage">再試行</button>
    </div>
  </section>
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

.visit-description strong {
  margin-inline-start: .5rem;
  color: var(--color-text);
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

.payment-options {
  display: grid;
  gap: .9rem;
}

.payment-option {
  flex-direction: column;
  gap: .2rem;
  padding-block: 1rem;
}

.payment-option small {
  color: var(--color-text-secondary);
  font-weight: 400;
}

@media (min-width: 36rem) {
  .payment-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
