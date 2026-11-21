<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import QrCodeScanner from '../../components/qrcode/QrCodeScanner.vue'
import { ACTIVATION_CODE_EXAMPLE, formatActivationCode, readActivationQr } from './domain/activationCode.js'
import { SETUP_MESSAGES } from './setupMessages.js'

const props = defineProps({
  busy: Boolean,
  errorMessage: { type: String, default: '' },
  invalidCode: Boolean,
})
const emit = defineEmits(['activate', 'edit'])
const code = ref('')
const codeInput = ref(null)
const activateButton = ref(null)
const formatError = ref('')
const scanning = ref(false)
const qrMessage = ref('')
const displayedError = computed(() => formatError.value || props.errorMessage)
const codeIsInvalid = computed(() => Boolean(formatError.value) || props.invalidCode)

function clearError() {
  formatError.value = ''
  emit('edit')
}

function editCode() {
  clearError()
  if (!scanning.value) qrMessage.value = ''
}

function submit() {
  if (props.busy) return

  clearError()
  const formatted = formatActivationCode(code.value)
  if (!formatted) {
    formatError.value = SETUP_MESSAGES.codeFormat
    codeInput.value?.focus()
    return
  }

  emit('activate', formatted)
}

watch(scanning, (active) => {
  if (active) qrMessage.value = ''
})

async function applyQrReadings(readings) {
  const scannedCode = readings.map(readActivationQr).find(Boolean)
  if (!scannedCode) {
    qrMessage.value = SETUP_MESSAGES.invalidQr
    return
  }

  scanning.value = false
  qrMessage.value = SETUP_MESSAGES.qrRead
  code.value = scannedCode
  clearError()
  await nextTick()
  activateButton.value?.focus()
}
</script>

<template>
  <div class="activation-methods">
    <form class="method manual-method" aria-labelledby="manual-title" novalidate @submit.prevent="submit">
      <div class="method-heading">
        <span class="method-symbol" aria-hidden="true"><span class="keyboard-icon"></span></span>
        <h2 id="manual-title">手入力で登録</h2>
      </div>
      <p class="method-description">コードを入力するか、コピーして貼り付けてください。</p>

      <div class="code-field">
        <div class="field-heading">
          <label for="activation-code">有効化コード</label>
          <span id="activation-code-hint">英数字4文字 × 3組</span>
        </div>
        <input
          id="activation-code"
          ref="codeInput"
          v-model="code"
          type="text"
          :placeholder="ACTIVATION_CODE_EXAMPLE"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          required
          :disabled="busy"
          :aria-invalid="codeIsInvalid || undefined"
          :aria-describedby="displayedError ? 'activation-code-hint activation-error' : 'activation-code-hint'"
          @input="editCode"
        >
        <p v-if="displayedError" id="activation-error" class="status-message status-message--error" role="alert">{{ displayedError }}</p>
        <p v-if="busy" class="status-message" role="status">{{ SETUP_MESSAGES.activating }}</p>
      </div>

      <div class="manual-action">
        <button ref="activateButton" class="button button--primary activate-button" type="submit" :disabled="busy">
          端末を有効化
          <span class="action-arrow" aria-hidden="true"></span>
        </button>
      </div>
    </form>

    <section class="method camera-method" aria-labelledby="qr-title">
      <div class="method-heading">
        <span class="method-symbol" aria-hidden="true"><span class="camera-icon"></span></span>
        <h2 id="qr-title">QRコードで登録</h2>
      </div>
      <p class="method-description">店舗管理画面に表示されたQRコードを読み取ります。</p>

      <div class="camera-action">
        <QrCodeScanner
          v-model:scanning="scanning"
          :disabled="busy"
          @scan="applyQrReadings"
          @error="qrMessage = SETUP_MESSAGES.cameraUnavailable"
        >
          <template #unavailable>
            <p class="camera-unavailable" role="status">このブラウザーでは、カメラで読み取れません。</p>
            <button class="button button--secondary manual-fallback" type="button" :disabled="busy" @click="codeInput?.focus()">
              コード入力欄へ移動
            </button>
          </template>
        </QrCodeScanner>
      </div>
      <p v-if="qrMessage" class="status-message qr-message" role="status">{{ qrMessage }}</p>
    </section>
  </div>
</template>

<style scoped>
.activation-methods {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr);
  gap: clamp(.85rem, 2.4vw, 1.5rem);
}

.method {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  padding: clamp(1.2rem, 3vw, 2.1rem);
  border: 1px solid var(--color-panel-border);
  border-radius: 1.15rem;
}

.manual-method {
  background: var(--color-surface);
}

.camera-method {
  --qr-preview-background: #1a3327;
  --qr-preview-border: #fff9ed52;
  --qr-guide-color: #bed0ae;

  color: var(--color-on-accent);
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.method-heading {
  display: flex;
  align-items: center;
  gap: .8rem;
}

.method-heading h2 {
  margin: 0;
  font-size: clamp(1.18rem, 2.15vw, 1.55rem);
  font-weight: 750;
  line-height: 1.4;
}

.method-symbol {
  display: grid;
  flex: none;
  inline-size: 2.65rem;
  aspect-ratio: 1;
  place-items: center;
  border-radius: .7rem;
  color: var(--color-accent);
  background: var(--color-success-surface);
}

.camera-method .method-symbol {
  color: inherit;
  background: #fff9ed1f;
}

.keyboard-icon {
  position: relative;
  inline-size: 1.3rem;
  block-size: .88rem;
  border: 1.5px solid currentColor;
  border-radius: .2rem;
}

.keyboard-icon::after {
  position: absolute;
  inset: .17rem .19rem;
  border-block-start: 2px dotted currentColor;
  border-block-end: 1px solid currentColor;
  content: "";
}

.camera-icon {
  display: grid;
  inline-size: 1.3rem;
  block-size: .92rem;
  place-items: center;
  border: 1.5px solid currentColor;
  border-radius: .2rem;
}

.camera-icon::before {
  inline-size: .43rem;
  aspect-ratio: 1;
  border: 1px solid currentColor;
  border-radius: 50%;
  content: "";
}

.method-description {
  margin: .9rem 0 0;
  color: var(--color-text-secondary);
}

.camera-method .method-description,
.qr-message {
  color: #ecf0e4;
}

.code-field,
.camera-action {
  margin-block-start: 1.4rem;
}

.field-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: .15rem .8rem;
  margin-block-end: .5rem;
}

label {
  font-weight: 700;
}

.field-heading span {
  color: var(--color-text-secondary);
  font-size: .8125rem;
}

input {
  display: block;
  inline-size: 100%;
  min-block-size: var(--control-min-height);
  padding: .7rem 1rem;
  border: 1px solid var(--color-control-border);
  border-radius: var(--control-radius);
  background: var(--color-input-surface);
  color: inherit;
  font-family: ui-monospace, Consolas, monospace;
  font-size: clamp(1rem, 3vw, 1.2rem);
  letter-spacing: .06em;
}

input::placeholder {
  color: var(--color-text-secondary);
}

input[aria-invalid="true"] {
  border-color: var(--color-error);
}

.manual-action {
  margin-block-start: auto;
  padding-block-start: 1.15rem;
}

.activate-button {
  position: relative;
  padding-inline: 2.5rem;
}

.action-arrow {
  position: absolute;
  inset-inline-end: 1.25rem;
  inline-size: .48rem;
  aspect-ratio: 1;
  border-block-start: 2px solid currentColor;
  border-inline-end: 2px solid currentColor;
  transform: rotate(45deg);
}

.camera-action {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}

.camera-unavailable {
  display: flex;
  flex: 1;
  align-items: center;
  min-block-size: 5rem;
  margin: 0;
  padding: .75rem .9rem;
  border: 1px solid var(--qr-preview-border);
  border-radius: var(--control-radius);
  background: var(--qr-preview-background);
}

.manual-fallback {
  margin-block-start: .85rem;
}

@media (max-width: 48rem) {
  .activation-methods {
    grid-template-columns: minmax(0, 1fr);
  }

  .method-description {
    margin-block-start: .65rem;
  }

  .code-field,
  .camera-action {
    margin-block-start: 1.05rem;
  }
}
</style>
