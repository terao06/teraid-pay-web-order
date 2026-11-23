<script setup>
import { onMounted, ref } from 'vue'
import { encodeFaceImageFile, FACE_IMAGE_FILE_TYPES } from './encodeFaceImage.js'

const props = defineProps({ busy: { type: Boolean, required: true } })
const emit = defineEmits(['capture', 'close'])
const heading = ref(null)
const content = ref('')
const processing = ref(false)
const error = ref('')

async function selectImage(event) {
  const input = event.target
  const file = input.files[0]
  content.value = ''
  error.value = ''
  if (!file) return

  processing.value = true
  try {
    content.value = await encodeFaceImageFile(file)
  } catch {
    input.value = ''
    error.value = '画像を読み込めませんでした。JPEG または PNG の顔画像を選び直してください。'
  } finally {
    processing.value = false
  }
}

function submit() {
  if (props.busy || !content.value) return
  const image = content.value
  content.value = ''
  emit('capture', image)
}

onMounted(() => heading.value?.focus())
</script>

<template>
  <section class="upload-panel" aria-labelledby="payment-upload-title">
    <h2 id="payment-upload-title" ref="heading" tabindex="-1">顔画像アップロード（動作確認用）</h2>
    <label for="payment-face-file">支払う方の顔画像（JPEG・PNG）</label>
    <input
      id="payment-face-file" type="file" :accept="FACE_IMAGE_FILE_TYPES.join(',')"
      :disabled="busy || processing" @change="selectImage"
    >
    <p v-if="error" class="status-message status-message--error" role="alert">{{ error }}</p>
    <p v-else-if="processing" class="status-message" role="status">顔画像を読み込んでいます。</p>
    <button class="button button--primary" type="button" :disabled="busy || !content" @click="submit">
      この画像で決済を送信
    </button>
    <button class="button button--secondary" type="button" @click="emit('close')">画像選択を閉じる</button>
  </section>
</template>

<style scoped>
.upload-panel {
  display: grid;
  gap: .75rem;
}

h2, p {
  margin: 0;
}
</style>
