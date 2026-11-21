<script setup>
import { ref } from 'vue'

defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
const emit = defineEmits(['dismiss'])
const dialog = ref(null)

function open() {
  if (!dialog.value?.open) dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}

function dismiss() {
  close()
  emit('dismiss')
}

defineExpose({ open, close })
</script>

<template>
  <dialog
    :id="id"
    ref="dialog"
    class="modal-dialog"
    :aria-labelledby="`${id}-title`"
    :aria-describedby="description ? `${id}-description` : undefined"
    @click.self="dismiss"
    @keydown.esc.stop.prevent="dismiss"
    @cancel.prevent="dismiss"
  >
    <div class="modal-content">
      <h2 :id="`${id}-title`">{{ title }}</h2>
      <p v-if="description" :id="`${id}-description`">{{ description }}</p>
      <slot />
      <div class="modal-actions">
        <slot name="actions" :dismiss="dismiss">
          <button class="button button--primary" type="button" autofocus @click="dismiss">閉じる</button>
        </slot>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.modal-dialog {
  position: fixed;
  inset: 0;
  inline-size: min(27rem, 100% - 2rem);
  max-inline-size: none;
  block-size: fit-content;
  max-block-size: calc(100dvh - 2rem);
  margin: auto;
  padding: 0;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-panel-border);
  border-radius: 1rem;
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: 0 6px 28px #242b2340;
}

.modal-dialog::backdrop {
  background: #1b29216b;
}

.modal-content {
  padding: clamp(1rem, 4vw, 1.5rem);
  overflow-wrap: anywhere;
}

h2 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.35;
}

p {
  margin: .65rem 0 0;
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: .65rem;
  margin-block-start: 1.25rem;
}

.modal-actions .button,
.modal-actions :slotted(.button) {
  inline-size: auto;
  min-inline-size: 7rem;
}
</style>
