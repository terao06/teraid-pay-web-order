<script setup>
import { ref } from 'vue'
import ToastMessage from '../../components/feedback/ToastMessage.vue'
import CartReview from './CartReview.vue'
import CartSummary from './CartSummary.vue'

defineProps({
  lines: { type: Array, required: true },
  quantity: { type: Number, required: true },
  totals: { type: Array, required: true },
})
const emit = defineEmits(['change-quantity', 'remove', 'close'])
const dialog = ref(null)
const removalToast = ref(null)

function open() {
  if (!dialog.value?.open) dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}

function afterClose() {
  removalToast.value?.dismiss()
  emit('close')
}

defineExpose({ open })
</script>

<template>
  <dialog
    id="cart-drawer"
    ref="dialog"
    class="cart-drawer"
    aria-labelledby="cart-drawer-title"
    @click.self="close"
    @close.self="afterClose"
  >
    <div class="drawer-panel">
      <header class="drawer-header">
        <h2 id="cart-drawer-title">カート</h2>
        <button class="button button--secondary drawer-close" type="button" autofocus @click="close">閉じる</button>
      </header>

      <div class="drawer-content">
        <CartReview
          :lines="lines"
          @change-quantity="(key, quantity) => emit('change-quantity', key, quantity)"
          @remove="emit('remove', $event)"
          @removed="removalToast?.show('カートから削除しました')"
        />
      </div>

      <footer class="drawer-total">
        <CartSummary :quantity="quantity" :totals="totals" />
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
  border-block-start: 1px solid var(--color-panel-border);
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
