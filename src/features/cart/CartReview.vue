<script setup>
import { nextTick, ref } from 'vue'
import ModalDialog from '../../components/feedback/ModalDialog.vue'
import { formatMenuAmount } from '../menu-categories/menuItemLabels.js'
import { cartLineAmount, MAX_CART_QUANTITY } from './cart.js'

defineProps({ lines: { type: Array, required: true } })
const emit = defineEmits(['change-quantity', 'remove', 'removed'])
const emptyMessage = ref(null)
const confirmation = ref(null)
const pendingLine = ref(null)
let removeButton

async function requestRemoval(line, event) {
  if (pendingLine.value) return
  removeButton = event.currentTarget
  pendingLine.value = line
  await nextTick()
  confirmation.value?.open()
}

function cancelRemoval() {
  pendingLine.value = null
  removeButton?.focus({ preventScroll: true })
}

async function confirmRemoval() {
  const line = pendingLine.value
  if (!line) return

  const row = removeButton.closest('.cart-line')
  const sibling = row.nextElementSibling ?? row.previousElementSibling
  const nextButton = sibling?.querySelector('.remove-action')
  pendingLine.value = null
  confirmation.value?.close()
  emit('remove', line.key)
  await nextTick()
  const focusTarget = nextButton ?? emptyMessage.value
  focusTarget?.focus()
  emit('removed')
}
</script>

<template>
  <p v-if="!lines.length" ref="emptyMessage" class="cart-empty" role="status" tabindex="-1">
    カートに商品が入っていません。
  </p>
  <ul v-else class="cart-lines">
    <li v-for="line in lines" :key="line.key" class="cart-line">
      <div class="line-content">
        <h3 class="line-title">{{ line.name }}</h3>
        <ul v-if="line.options.length" class="line-options">
          <li v-for="option in line.options" :key="option.id">
            {{ option.groupName }} · {{ option.name }}
          </li>
        </ul>
        <p>{{ formatMenuAmount(line.unitPrice) }} {{ line.tokenSymbol }} / 点</p>
      </div>

      <div class="line-actions">
        <p class="line-amount" role="status" aria-atomic="true">
          {{ formatMenuAmount(cartLineAmount(line)) }} {{ line.tokenSymbol }}
        </p>
        <div class="line-controls">
          <div class="quantity-controls" role="group" :aria-label="`${line.name}の数量`">
            <button
              type="button"
              class="button button--secondary quantity-button"
              :aria-label="`${line.name}を1点減らす`"
              :disabled="line.quantity === 1"
              @click="emit('change-quantity', line.key, line.quantity - 1)"
            >−</button>
            <span class="quantity-value">{{ line.quantity }}</span>
            <button
              type="button"
              class="button button--secondary quantity-button"
              :aria-label="`${line.name}を1点増やす`"
              :disabled="line.quantity === MAX_CART_QUANTITY"
              @click="emit('change-quantity', line.key, line.quantity + 1)"
            >＋</button>
          </div>
          <button
            type="button"
            class="button button--secondary remove-action"
            :aria-label="`${line.name}をカートから削除`"
            aria-haspopup="dialog"
            aria-controls="cart-remove-dialog"
            @click="requestRemoval(line, $event)"
          >削除</button>
        </div>
      </div>
    </li>
  </ul>

  <ModalDialog
    id="cart-remove-dialog"
    ref="confirmation"
    class="cart-remove-dialog"
    title="カートから削除しますか？"
    :description="pendingLine ? `「${pendingLine.name}」${pendingLine.quantity}点をカートから削除します。` : ''"
    @dismiss="cancelRemoval"
  >
    <ul v-if="pendingLine?.options.length" class="line-options">
      <li v-for="option in pendingLine.options" :key="option.id">{{ option.groupName }} · {{ option.name }}</li>
    </ul>
    <template #actions="{ dismiss }">
      <button class="button button--secondary remove-cancel" type="button" autofocus @click="dismiss">
        キャンセル
      </button>
      <button class="button remove-confirm" type="button" @click="confirmRemoval">削除する</button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.cart-empty,
.cart-line {
  margin: 0;
  padding: clamp(1rem, 3vw, 1.5rem);
  border: 1px solid var(--color-panel-border);
  border-radius: 1rem;
  background: var(--color-surface);
}

.cart-lines,
.line-options {
  margin: 0;
  padding: 0;
  list-style: none;
}

.cart-lines,
.cart-line {
  display: grid;
  gap: 1rem;
}

.cart-line {
  align-items: center;
  overflow-wrap: anywhere;
  scroll-margin-block: 1rem 8rem;
}

.line-title,
.line-amount {
  margin: 0;
  color: var(--color-accent-hover);
  font-size: clamp(1.15rem, 2.2vw, 1.4rem);
  font-weight: 800;
  line-height: 1.35;
}

.line-content p,
.line-options {
  margin: .45rem 0 0;
  color: var(--color-text-secondary);
  font-size: .925rem;
}

.line-actions,
.line-controls,
.quantity-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .5rem .75rem;
}

.line-actions {
  justify-content: space-between;
}

.quantity-controls {
  gap: .35rem;
}

.line-amount,
.quantity-value {
  font-variant-numeric: tabular-nums;
}

.quantity-value {
  min-inline-size: 2rem;
  text-align: center;
  font-weight: 700;
}

.quantity-button {
  inline-size: 3rem;
  padding: .25rem;
  font-size: 1.25rem;
}

.quantity-button:disabled {
  cursor: default;
}

.remove-action {
  inline-size: auto;
  padding-inline: .7rem;
  color: var(--color-error);
}

.remove-confirm {
  color: var(--color-on-accent);
  background: var(--color-error);
}
</style>
