<script setup>
import { ref, watch } from 'vue'
import ToastMessage from '../../components/feedback/ToastMessage.vue'
import { formatMenuAmount } from '../menu-categories/menuItemLabels.js'
import CartReview from './CartReview.vue'
import CartSummary from './CartSummary.vue'

const props = defineProps({
  lines: { type: Array, required: true },
  quantity: { type: Number, required: true },
  totals: { type: Array, required: true },
  paymentMode: { type: String, required: true },
  pending: { type: Boolean, required: true },
  receipt: { type: Object, default: null },
  locked: { type: Boolean, required: true },
  mixedTokens: { type: Boolean, required: true },
  sending: { type: Boolean, required: true },
  orderError: { type: String, required: true },
})
const emit = defineEmits(['change-quantity', 'remove', 'close', 'confirm', 'continue-ordering'])
const dialog = ref(null)
const removalToast = ref(null)
const heading = ref(null)
const orderAlert = ref(null)

watch(() => props.sending, (value) => {
  if (!dialog.value?.open) return
  if (value || props.receipt) heading.value?.focus()
  else if (props.orderError) orderAlert.value?.focus()
}, { flush: 'post' })

function open() {
  if (!dialog.value?.open) dialog.value?.showModal()
}

function close() {
  if (!props.sending) dialog.value?.close()
}

function afterClose() {
  removalToast.value?.dismiss()
  emit('close')
}

defineExpose({ open, close })
</script>

<template>
  <dialog
    id="cart-drawer"
    ref="dialog"
    class="cart-drawer"
    aria-labelledby="cart-drawer-title"
    @click.self="close"
    @cancel.prevent="close"
    @close.self="afterClose"
  >
    <div class="drawer-panel">
      <header class="drawer-header">
        <h2 id="cart-drawer-title" ref="heading" tabindex="-1">{{ receipt ? 'ご注文を受け付けました' : 'カート' }}</h2>
        <button class="button button--secondary drawer-close" type="button" :disabled="sending" autofocus @click="close">閉じる</button>
      </header>

      <div class="drawer-content">
        <section v-if="receipt" class="receipt" aria-labelledby="cart-drawer-title">
          <dl>
            <div>
              <dt>注文番号</dt>
              <dd>{{ receipt.menu_order_id }}</dd>
            </div>
            <div>
              <dt>注文金額</dt>
              <dd>{{ formatMenuAmount(receipt.total_amount) }} {{ receipt.token_symbol }}</dd>
            </div>
          </dl>
          <p v-if="paymentMode === 'combined'">お会計の際は、店舗スタッフにお声がけください。</p>
          <p v-else>今回のご注文のお支払いについては、店舗スタッフにお声がけください。</p>
        </section>
        <CartReview
          v-else
          :lines="lines"
          :locked="locked"
          @change-quantity="(key, quantity) => emit('change-quantity', key, quantity)"
          @remove="emit('remove', $event)"
          @removed="removalToast?.show('カートから削除しました')"
        />
      </div>

      <footer v-if="!receipt || paymentMode === 'combined' || orderError" class="drawer-total">
        <CartSummary v-if="!receipt" :quantity="quantity" :totals="totals" />
        <p v-if="orderError" ref="orderAlert" class="status-message status-message--error" role="alert" tabindex="-1">{{ orderError }}</p>
        <p v-else-if="sending" class="status-message" role="status">注文を送信しています。</p>
        <p v-else-if="pending" class="status-message" role="status">前回の送信結果を確認するには、同じ内容で再試行してください。</p>
        <p v-else-if="mixedTokens" class="status-message status-message--error" role="alert">
          1回の注文に異なる通貨の商品が含まれています。カートの内容を調整してください。
        </p>
        <button
          v-if="receipt && paymentMode === 'combined'"
          class="button button--primary"
          type="button"
          @click="emit('continue-ordering')"
        >追加注文へ</button>
        <button
          v-else-if="!receipt"
          class="button button--primary"
          type="button"
          :disabled="sending || !lines.length || mixedTokens || (locked && !pending)"
          @click="emit('confirm')"
        >{{ pending && !sending ? '注文を再試行' : '注文を確定' }}</button>
      </footer>
    </div>
    <ToastMessage ref="removalToast" class="cart-removal-toast" />
  </dialog>
</template>

<style scoped>
:global(html:has(.cart-drawer[open])) {
  overflow: hidden;
  scrollbar-gutter: stable;
}

.cart-drawer {
  position: fixed;
  inset-block: 0;
  inset-inline: auto 0;
  inline-size: min(92vw, 28rem);
  max-inline-size: none;
  block-size: 100dvh;
  max-block-size: none;
  margin: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  color: var(--color-text);
  background: transparent;
}

.cart-drawer::backdrop {
  background: #1b292180;
}

.drawer-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  block-size: 100%;
  background: var(--color-background);
  box-shadow: -8px 0 28px #242b2333;
}

.drawer-header,
.drawer-total {
  padding: .9rem clamp(.8rem, 3vw, 1.35rem);
  background: var(--color-surface);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  border-block-end: 1px solid var(--color-panel-border);
}

h2 {
  margin: 0;
  color: var(--color-accent-hover);
  font-size: 1.55rem;
}

.drawer-close {
  inline-size: auto;
  min-inline-size: 4.5rem;
}

.drawer-content {
  padding: clamp(.75rem, 3vw, 1.25rem);
  overflow: auto;
  overscroll-behavior: contain;
}

.drawer-total {
  --cart-summary-gap: .15rem;
  --cart-summary-label-size: .875rem;
  --cart-summary-amount-color: var(--color-accent-hover);
  --cart-summary-amount-size: 1.15rem;
  display: grid;
  gap: .65rem;
  max-block-size: 55dvh;
  overflow: auto;
  border-block-start: 1px solid var(--color-panel-border);
}

.drawer-total .status-message {
  margin: 0;
}

.receipt {
  padding: 1rem;
  border: 1px solid var(--color-panel-border);
  border-radius: 1rem;
  background: var(--color-surface);
  overflow-wrap: anywhere;
}

.receipt dl {
  display: grid;
  gap: .85rem;
  margin: 0;
}

.receipt dt {
  color: var(--color-text-secondary);
}

.receipt dd {
  margin: 0;
  color: var(--color-accent-hover);
  font-size: 1.25rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.receipt p {
  margin-block: 1rem 0;
}

@media (prefers-reduced-motion: no-preference) {
  .cart-drawer[open] > .drawer-panel {
    animation: open-cart-drawer .18s ease-out;
  }
}

@keyframes open-cart-drawer {
  from { transform: translateX(100%); }
}
</style>
