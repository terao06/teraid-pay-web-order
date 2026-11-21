<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const SCAN_INTERVAL_MS = 200
const props = defineProps({ disabled: Boolean })
const scanning = defineModel('scanning', { type: Boolean, default: false })
const emit = defineEmits(['scan', 'error'])

const supported = typeof globalThis.BarcodeDetector === 'function'
  && Boolean(globalThis.navigator?.mediaDevices?.getUserMedia)
const camera = ref(null)
let activeScan

function stopCamera() {
  const scan = activeScan
  activeScan = undefined
  scan?.stream?.getTracks().forEach((track) => track.stop())
  clearTimeout(scan?.timer)
  if (camera.value) camera.value.srcObject = null
}

function closeCamera() {
  stopCamera()
  scanning.value = false
}

function cameraFailed(scan) {
  if (activeScan !== scan) return

  closeCamera()
  emit('error')
}

async function startCamera() {
  if (activeScan) return
  if (!supported || props.disabled) {
    closeCamera()
    return
  }

  const scan = {}
  activeScan = scan
  try {
    const detector = new BarcodeDetector({ formats: ['qr_code'] })
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    if (activeScan !== scan) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    scan.stream = stream
    await nextTick()
    if (activeScan !== scan) return

    const video = camera.value
    video.srcObject = stream
    await video.play()

    async function detect() {
      if (activeScan !== scan) return

      try {
        const readings = await detector.detect(video)
        if (activeScan !== scan) return

        if (readings.length) emit('scan', readings.map(({ rawValue }) => rawValue))
        scan.timer = setTimeout(detect, SCAN_INTERVAL_MS)
      } catch {
        cameraFailed(scan)
      }
    }

    await detect()
  } catch {
    cameraFailed(scan)
  }
}

function closeCameraWhenHidden() {
  if (document.hidden) closeCamera()
}

watch(scanning, (active) => {
  if (active) startCamera()
  else stopCamera()
}, { immediate: true })

watch(() => props.disabled, (disabled) => {
  if (disabled) closeCamera()
})

onMounted(() => document.addEventListener('visibilitychange', closeCameraWhenHidden))
onUnmounted(() => {
  stopCamera()
  document.removeEventListener('visibilitychange', closeCameraWhenHidden)
})
</script>

<template>
  <div v-if="supported" class="qr-scanner">
    <div class="preview" :class="{ 'preview--idle': !scanning }" aria-hidden="true">
      <video v-if="scanning" ref="camera" playsinline muted></video>
      <span class="preview-guide"></span>
    </div>
    <button v-if="scanning" class="button button--secondary" type="button" @click="closeCamera">カメラを閉じる</button>
    <button v-else class="button button--secondary" type="button" :disabled="disabled" @click="scanning = true">
      <span class="qr-glyph" aria-hidden="true"></span>
      カメラを開く
    </button>
  </div>
  <slot v-else name="unavailable"></slot>
</template>

<style scoped>
.qr-scanner {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: .85rem;
}

.qr-glyph {
  position: relative;
  align-self: center;
  inline-size: .42rem;
  block-size: .42rem;
  margin-block-end: .62rem;
  margin-inline-end: .62rem;
  border: 1px solid currentColor;
  border-radius: .06rem;
}

.qr-glyph::before,
.qr-glyph::after {
  position: absolute;
  inline-size: inherit;
  block-size: inherit;
  border: inherit;
  border-radius: inherit;
  content: "";
}

.qr-glyph::before {
  inset-block-start: -1px;
  inset-inline-start: .52rem;
}

.qr-glyph::after {
  inset-block-start: .52rem;
  inset-inline-start: -1px;
}

.preview {
  position: relative;
  display: grid;
  flex: 1;
  min-block-size: 5rem;
  place-items: center;
  overflow: hidden;
  border-radius: var(--control-radius);
  background: var(--qr-preview-background, var(--color-text));
}

.preview--idle {
  border: 1px dashed var(--qr-preview-border, #fff9ed52);
}

video {
  display: block;
  inline-size: 100%;
  max-block-size: 16rem;
  aspect-ratio: 16 / 10;
  object-fit: cover;
}

.preview-guide {
  position: absolute;
  inline-size: min(50%, 9.5rem);
  aspect-ratio: 1;
  border: 2px solid #fff9ed;
  border-radius: .65rem;
  box-shadow: 0 0 0 100vmax #1a201966;
  pointer-events: none;
}

.preview--idle .preview-guide {
  inline-size: 2.6rem;
  border: 1.5px solid var(--qr-guide-color, #fff9ed);
  border-radius: .4rem;
  box-shadow: none;
}
</style>
