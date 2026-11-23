<script setup>
import { ref, watch } from 'vue'
import SideDrawer from '../../components/feedback/SideDrawer.vue'
import ToastMessage from '../../components/feedback/ToastMessage.vue'
import CartReview from './CartReview.vue'
import CartSummary from './CartSummary.vue'

const props = defineProps({
  lines: { type: Array, required: true },
  quantity: { type: Number, required: true },
  totals: { type: Array, required: true },
  canContinueOrdering: { type: Boolean, required: true },
  pending: { type: Boolean, required: true },
  locked: { type: Boolean, required: true },
  mixedTokens: { type: Boolean, required: true },
  sending: { type: Boolean, required: true },
  orderError: { type: String, required: true },
})
const emit = defineEmits(['change-quantity', 'remove', 'close', 'confirm', 'continue-ordering'])
const drawer = ref(null)
const removalToast = ref(null)
const orderAlert = ref(null)

watch(() => props.sending, (value) => {
  if (!drawer.value?.isOpen()) return
  if (value) drawer.value.focusHeading()
  else if (props.orderError) orderAlert.value?.focus()
}, { flush: 'post' })

function afterClose() {
  removalToast.value?.dismiss()
  emit('close')
}

defineExpose({
  open: () => drawer.value?.open(),
  close: () => drawer.value?.close(),
})
</script>

<template>
  <SideDrawer
    id="cart-drawer"
    ref="drawer"
    title="カート"
    tab-label="カートを確認"
    :close-disabled="sending"
    @close="afterClose"
  >
    <template #tab-badge>
      <strong>{{ quantity }}点</strong>
    </template>

    <CartReview
      :lines="lines"
      :locked="locked"
      @change-quantity="(key, quantity) => emit('change-quantity', key, quantity)"
      @remove="emit('remove', $event)"
      @removed="removalToast?.show('カートから削除しました')"
    />

    <template #footer>
      <footer class="drawer-total">
        <CartSummary :quantity="quantity" :totals="totals" />
        <p v-if="orderError" ref="orderAlert" class="status-message status-message--error" role="alert" tabindex="-1">{{ orderError }}</p>
        <p v-else-if="sending" class="status-message" role="status">注文を送信しています。</p>
        <p v-else-if="pending" class="status-message" role="status">前回の送信結果を確認するには、同じ内容で再試行してください。</p>
        <p v-else-if="mixedTokens" class="status-message status-message--error" role="alert">
          1回の注文に異なる通貨の商品が含まれています。カートの内容を調整してください。
        </p>
        <button
          v-if="canContinueOrdering"
          class="button button--secondary"
          type="button"
          @click="emit('continue-ordering')"
        >追加注文へ</button>
        <button
          v-else
          class="button button--primary"
          type="button"
          :disabled="sending || !lines.length || mixedTokens || (locked && !pending)"
          @click="emit('confirm')"
        >{{ pending && !sending ? '注文を再試行' : '注文を確定' }}</button>
      </footer>
    </template>
    <template #feedback>
      <ToastMessage ref="removalToast" class="cart-removal-toast" />
    </template>
  </SideDrawer>
</template>

<style scoped>
.drawer-total {
  padding: .9rem clamp(.8rem, 3vw, 1.35rem);
  background: var(--color-surface);
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
</style>
