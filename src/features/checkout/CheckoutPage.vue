<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { formatMenuAmount } from '../menu-categories/menuItemLabels.js'
import FacePaymentCamera from './FacePaymentCamera.vue'

const FacePaymentUpload = __FACE_PAYMENT_UPLOAD__
  ? defineAsyncComponent(() => import('./FacePaymentUpload.vue'))
  : null

const props = defineProps({
  checkout: { type: Object, required: true },
  busy: { type: Boolean, required: true },
  polling: { type: Boolean, required: true },
  startingPayment: { type: Boolean, required: true },
  message: { type: String, required: true },
})
const emit = defineEmits(['action'])
const imageSource = ref(null)
const heading = ref(null)

const phase = computed(() => props.checkout.phase)
const summary = computed(() => props.checkout.summary)
const canChooseImage = computed(() => ['review', 'sending'].includes(phase.value))
const paymentConfirmed = computed(() => Boolean(summary.value) && ['paid', 'complete', 'completion_blocked'].includes(phase.value))
const title = computed(() => {
  if (paymentConfirmed.value) return 'お支払いが完了しました'
  if (['complete', 'completion_blocked'].includes(phase.value)) return 'ご注文の終了'
  return 'お会計'
})
const statusMessages = {
  create: '会計を作成しています。',
  sending: '顔認証決済を開始しています。',
  verify: '決済結果を確認しています。この画面でお待ちください。',
  complete: '来店セッションを終了しています。',
}
const status = computed(() => statusMessages[phase.value])
const loadingMessage = computed(() => {
  if (props.startingPayment) return statusMessages.sending
  if (props.polling) {
    return props.message ? '通信を再試行しています。この画面でお待ちください。' : statusMessages.verify
  }
  return ['create', 'complete'].includes(phase.value) && !props.message ? status.value : ''
})
const showLoading = computed(() => Boolean(loadingMessage.value))

function capture(content) {
  imageSource.value = null
  emit('action', 'pay', content)
}

function focusHeading() {
  heading.value?.focus()
}

function closeImageSource() {
  imageSource.value = null
  focusHeading()
}

onMounted(focusHeading)
watch([phase, () => summary.value?.checkout_id, showLoading], closeImageSource, { flush: 'post' })
</script>

<template>
  <section class="checkout-panel" aria-labelledby="checkout-title">
    <header class="checkout-header">
      <h1 id="checkout-title" ref="heading" tabindex="-1">{{ showLoading ? 'お会計中' : title }}</h1>
      <button
        v-if="phase === 'completion_blocked'"
        class="button button--secondary checkout-back" type="button" :disabled="busy"
        @click="emit('action', 'backToMenu')"
      >注文画面に戻る</button>
    </header>
    <div v-if="showLoading" class="checkout-loading">
      <span class="checkout-spinner" aria-hidden="true"></span>
      <p class="status-message" role="status">{{ loadingMessage }}</p>
    </div>
    <template v-else>
      <template v-if="paymentConfirmed">
        <p>注文番号 {{ summary.orders.map(({ menu_order_id }) => menu_order_id).join('、') }}</p>
        <p>お料理が届くまでお待ちください。</p>
      </template>

      <template v-if="summary && ['review', 'sending', 'verify', 'failed'].includes(phase)">
        <ul v-if="['review', 'sending', 'failed'].includes(phase)" class="checkout-orders">
          <li v-for="order in summary.orders" :key="order.menu_order_id" class="checkout-order">
            <h2>注文番号 {{ order.menu_order_id }}</h2>
            <ul class="order-items">
              <li v-for="(item, index) in order.items" :key="index">
                <div class="amount-row">
                  <span>{{ item.menu_item_name }} × {{ item.quantity }}</span>
                  <span>{{ formatMenuAmount(item.line_amount) }} {{ summary.token_symbol }}</span>
                </div>
                <ul v-if="item.options.length" class="order-options">
                  <li v-for="(option, optionIndex) in item.options" :key="optionIndex">
                    {{ option.option_group_name }} / {{ option.option_name }} × {{ option.option_quantity }}
                  </li>
                </ul>
              </li>
            </ul>
            <div class="amount-row">
              <span>注文合計</span>
              <strong>{{ formatMenuAmount(order.total_amount) }} {{ summary.token_symbol }}</strong>
            </div>
          </li>
        </ul>
        <div class="amount-row checkout-total">
          <span>お支払い合計</span>
          <strong>{{ formatMenuAmount(summary.total_amount) }} {{ summary.token_symbol }}</strong>
        </div>
      </template>

      <p v-if="busy && status" class="status-message" role="status">{{ status }}</p>
      <p v-if="phase === 'verify' && !busy && !message" class="status-message" role="status">{{ status }}</p>
      <p v-if="phase === 'sending' && !busy" class="status-message">
        前回の送信結果を確認するため、{{ FacePaymentUpload
          ? '同じお支払いの方の顔を撮影するか、顔画像を選んでください。'
          : '同じお支払いの方をもう一度撮影してください。' }}
      </p>
      <p v-if="phase === 'failed'" class="status-message status-message--error" role="alert">
        決済に失敗しました。会計を作り直し、金額を確認してからお支払いください。
      </p>
      <p v-if="phase === 'completion_blocked'" class="status-message status-message--error" role="alert">
        未払いの注文が残っているか、決済を処理中です。注文画面でご確認ください。
      </p>
      <p v-else-if="message" class="status-message status-message--error" role="alert">{{ message }}</p>

      <div class="checkout-actions">
        <FacePaymentCamera v-if="imageSource === 'camera'" @capture="capture" @close="closeImageSource" />
        <FacePaymentUpload
          v-else-if="FacePaymentUpload && imageSource === 'upload'"
          :busy="busy" @capture="capture" @close="closeImageSource"
        />
        <template v-else>
          <button
            v-if="canChooseImage"
            class="button button--primary" type="button" :disabled="busy" @click="imageSource = 'camera'"
          >{{ phase === 'review' ? '顔認証で支払う' : '撮影して決済を再確認' }}</button>
          <button
            v-if="FacePaymentUpload && canChooseImage"
            class="button button--secondary" type="button" :disabled="busy" @click="imageSource = 'upload'"
          >{{ phase === 'review' ? '顔画像で支払う（動作確認用）' : '顔画像で決済を再確認（動作確認用）' }}</button>
          <button
            v-if="phase === 'failed'"
            class="button button--primary" type="button" :disabled="busy" @click="emit('action', 'retryCheckout')"
          >会計をやり直す</button>
          <button
            v-else-if="phase === 'verify'"
            class="button button--secondary" type="button" :disabled="busy" @click="emit('action', 'verify')"
          >決済結果を確認</button>
          <button
            v-else-if="message && ['create', 'complete'].includes(phase)"
            class="button button--primary" type="button" :disabled="busy" @click="emit('action', phase)"
          >{{ phase === 'create' ? '会計作成を再試行' : '終了を再試行' }}</button>
          <button
            v-if="phase === 'completion_blocked'"
            class="button button--primary" type="button" :disabled="busy" @click="emit('action', 'retryCompletion')"
          >終了を再試行</button>
          <div v-if="phase === 'paid'" class="paid-actions">
            <button
              class="button button--primary" type="button" :disabled="busy" @click="emit('action', 'continueOrdering')"
            >追加注文する</button>
            <button
              class="button button--secondary" type="button" :disabled="busy" @click="emit('action', 'finish')"
            >注文を終了する</button>
          </div>
        </template>
      </div>
    </template>
  </section>
</template>

<style scoped>
.checkout-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .5rem 1rem;
}

.checkout-back {
  inline-size: auto;
}

.checkout-loading {
  display: grid;
  min-block-size: min(32rem, 65dvh);
  place-content: center;
  justify-items: center;
  gap: 1rem;
  text-align: center;
}

.checkout-loading .status-message {
  margin: 0;
}

.checkout-spinner {
  inline-size: 3rem;
  aspect-ratio: 1;
  border: .25rem solid var(--color-panel-border);
  border-block-start-color: var(--color-accent);
  border-radius: 50%;
}

@media (prefers-reduced-motion: no-preference) {
  .checkout-spinner {
    animation: checkout-spin .8s linear infinite;
  }
}

@keyframes checkout-spin {
  to { transform: rotate(1turn); }
}

.checkout-panel {
  inline-size: min(100%, 42rem);
  margin-inline: auto;
  padding: clamp(1rem, 4vw, 2rem);
  border: 1px solid var(--color-panel-border);
  border-radius: 1.25rem;
  background: var(--color-surface);
}

h1, h2 {
  margin: 0;
}

h1 {
  font-size: clamp(1.5rem, 3.6vw, 2.1rem);
}

h2 {
  font-size: 1rem;
}

.checkout-orders, .order-items {
  display: grid;
  gap: .75rem;
  padding: 0;
  list-style: none;
}

.checkout-order {
  padding: .85rem;
  border: 1px solid var(--color-panel-border);
  border-radius: var(--control-radius);
}

.order-options {
  padding-inline-start: 1.25rem;
  color: var(--color-text-secondary);
  font-size: .875rem;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: .25rem .75rem;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.checkout-total {
  margin-block-start: 1rem;
  padding: .8rem;
  border-radius: var(--control-radius);
  color: var(--color-accent-hover);
  background: var(--color-success-surface);
  font-size: 1.18rem;
}

.checkout-actions {
  display: grid;
  gap: .7rem;
  margin-block-start: 1.1rem;
}

.paid-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .7rem;
}

.paid-actions .button {
  padding-inline: .375rem;
  text-align: center;
}
</style>
