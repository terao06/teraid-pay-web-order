<script setup>
import { onUnmounted, ref } from 'vue'

const message = ref('')
const noticeId = ref(0)
const centerX = ref('')
let timer

function updateCenter() {
  centerX.value = `${window.innerWidth / 2}px`
}

function dismiss() {
  clearTimeout(timer)
  window.removeEventListener('resize', updateCenter)
  message.value = ''
}

function show(text) {
  dismiss()
  updateCenter()
  window.addEventListener('resize', updateCenter)
  message.value = text
  noticeId.value += 1
  timer = setTimeout(dismiss, 3000)
}

defineExpose({ show, dismiss })
onUnmounted(dismiss)
</script>

<template>
  <div class="toast-message" :style="{ left: centerX }" role="status" aria-atomic="true">
    <p v-if="message" :key="noticeId">{{ message }}</p>
  </div>
</template>

<style scoped>
.toast-message {
  position: fixed;
  z-index: 3;
  inset-block-start: 1rem;
  left: 50vw;
  inline-size: max-content;
  max-inline-size: calc(100vw - 2rem);
  transform: translateX(-50%);
  pointer-events: none;
}

p {
  margin: 0;
  padding: .7rem 1.25rem;
  border: 1px solid var(--color-accent);
  border-radius: .75rem;
  color: var(--color-accent-hover);
  background: var(--color-success-surface);
  box-shadow: 0 3px 14px #242b2333;
  font-weight: 700;
}
</style>
