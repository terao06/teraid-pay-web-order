<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { encodeFaceImage } from './encodeFaceImage.js'

const emit = defineEmits(['capture', 'close'])
const video = ref(null)
const ready = ref(false)
const error = ref('')
const heading = ref(null)
let stream
let closed = false

function stopCamera() {
  closed = true
  stream?.getTracks().forEach((track) => track.stop())
  if (video.value) video.value.srcObject = null
}

function close() {
  stopCamera()
  emit('close')
}

async function startCamera() {
  try {
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
    if (closed) {
      cameraStream.getTracks().forEach((track) => track.stop())
      return
    }

    stream = cameraStream
    video.value.srcObject = stream
    await video.value.play()
    if (!closed) ready.value = true
  } catch {
    if (closed) return
    stopCamera()
    error.value = 'カメラを開けませんでした。カメラの権限と接続を確認してください。'
  }
}

function capture() {
  if (!ready.value || closed) return
  try {
    const image = encodeFaceImage(video.value)
    stopCamera()
    emit('capture', image)
  } catch {
    error.value = '顔画像を撮影できませんでした。顔を枠に合わせて撮影し直してください。'
  }
}

function closeWhenHidden() {
  if (document.hidden) close()
}

onMounted(() => {
  heading.value?.focus()
  document.addEventListener('visibilitychange', closeWhenHidden)
  startCamera()
})
onUnmounted(() => {
  stopCamera()
  document.removeEventListener('visibilitychange', closeWhenHidden)
})
</script>

<template>
  <section class="camera-panel" aria-labelledby="payment-camera-title">
    <h2 id="payment-camera-title" ref="heading" tabindex="-1">顔を撮影</h2>
    <p>支払う方お一人の顔を枠に合わせてください。撮影すると顔認証と決済を開始します。</p>
    <div class="camera-preview">
      <video ref="video" playsinline muted aria-hidden="true"></video>
      <span class="camera-guide" aria-hidden="true"></span>
    </div>
    <p v-if="error" class="status-message status-message--error" role="alert">{{ error }}</p>
    <p v-else-if="!ready" class="status-message" role="status">カメラを起動しています。</p>
    <button class="button button--primary" type="button" :disabled="!ready" @click="capture">
      撮影して支払う
    </button>
    <button class="button button--secondary" type="button" @click="close">カメラを閉じる</button>
  </section>
</template>

<style scoped>
.camera-panel {
  display: grid;
  gap: .75rem;
}

h2, p {
  margin: 0;
}

.camera-preview {
  position: relative;
  display: grid;
  place-items: center;
  inline-size: min(100%, 20rem);
  margin-inline: auto;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--control-radius);
  background: var(--color-text);
}

video {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.camera-guide {
  position: absolute;
  inline-size: 66%;
  block-size: 78%;
  border: 2px solid var(--color-on-accent);
  border-radius: 45%;
  box-shadow: 0 0 0 100vmax #1a201966;
  pointer-events: none;
}
</style>
