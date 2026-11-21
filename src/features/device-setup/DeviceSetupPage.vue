<script setup>
import { computed, nextTick, ref } from 'vue'
import ActivationForm from './ActivationForm.vue'
import { SETUP_PHASE, useDeviceSetup } from './composables/useDeviceSetup.js'
import { SETUP_MESSAGES } from './setupMessages.js'

const { phase, deviceUuid, errorMessage, invalidCode, checkRegistration, activate, clearError } = useDeviceSetup()
const statusHeading = ref(null)
const showForm = computed(() => phase.value === SETUP_PHASE.setup || phase.value === SETUP_PHASE.activating)

async function focusStatus() {
  await nextTick()
  statusHeading.value?.focus()
}

async function submitActivation(code) {
  await activate(code)
  await focusStatus()
}

async function retrySetup() {
  await checkRegistration()
  await focusStatus()
}
</script>

<template>
  <header class="terminal-bar">
    <div class="terminal-bar-inner">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-name">Teraid Pay</span>
      </div>
      <span v-if="phase !== SETUP_PHASE.ready" class="operator-label">店舗スタッフ用</span>
    </div>
  </header>

  <main class="workspace" :class="{ 'workspace--ready': phase === SETUP_PHASE.ready }">
    <slot v-if="phase === SETUP_PHASE.ready" :device-uuid="deviceUuid" />

    <section v-else-if="showForm" aria-labelledby="setup-title">
      <header class="workspace-heading">
        <h1 id="setup-title">{{ SETUP_MESSAGES.setupTitle }}</h1>
        <p>店舗管理画面で発行した有効化コードを使って、この端末を登録します。</p>
      </header>
      <ActivationForm
        :busy="phase === SETUP_PHASE.activating"
        :error-message="errorMessage"
        :invalid-code="invalidCode"
        @activate="submitActivation"
        @edit="clearError"
      />
    </section>

    <section v-else class="setup-result" aria-labelledby="setup-status-title">
      <template v-if="phase === SETUP_PHASE.retry">
        <span class="status-mark attention-mark" aria-hidden="true">!</span>
        <h1 id="setup-status-title" ref="statusHeading" tabindex="-1">{{ SETUP_MESSAGES.retryTitle }}</h1>
        <p class="status-message status-message--error retry-notice" role="alert">{{ errorMessage }}</p>
        <button class="button button--primary retry-button" type="button" @click="retrySetup">再試行</button>
      </template>

      <template v-else>
        <h1 id="setup-status-title">{{ SETUP_MESSAGES.setupTitle }}</h1>
        <p class="result-description" role="status">{{ SETUP_MESSAGES.checking }}</p>
      </template>
    </section>
  </main>
</template>

<style scoped>
.terminal-bar {
  color: var(--color-on-accent);
  background: var(--color-accent-hover);
}

.terminal-bar-inner,
.workspace {
  inline-size: min(68rem, 100% - clamp(1.5rem, 7vw, 6rem));
  margin-inline: auto;
}

.terminal-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  min-block-size: clamp(3.75rem, 8vh, 4.75rem);
  padding-block: .625rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: .7rem;
}

.brand-mark {
  display: grid;
  flex: none;
  inline-size: 2.25rem;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid #fff9ed45;
  border-radius: .7rem;
}

.brand-mark::before,
.brand-mark::after {
  grid-area: 1 / 1;
  aspect-ratio: 1;
  border: 1px solid currentColor;
  border-radius: 50%;
  content: "";
}

.brand-mark::before {
  inline-size: 1.12rem;
}

.brand-mark::after {
  inline-size: .68rem;
  color: var(--color-brass-light);
}

.brand-name {
  font: 600 clamp(1.25rem, 2.5vw, 1.5rem) / 1 Georgia, serif;
  letter-spacing: -.025em;
  white-space: nowrap;
}

.operator-label {
  padding-inline-start: .8rem;
  border-inline-start: 1px solid #fff9ed45;
  font-size: .85rem;
  font-weight: 600;
  white-space: nowrap;
}

.workspace {
  padding-block: clamp(1.75rem, 7vh, 4.25rem) 2rem;
}

.workspace--ready {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.workspace--ready:has(> .menu-panel) {
  padding-block: clamp(1rem, 3vh, 2rem) clamp(.75rem, 2vh, 1.25rem);
}

.workspace-heading {
  margin-block-end: clamp(1.35rem, 4vh, 2.25rem);
}

h1 {
  margin: 0;
  font-size: clamp(1.65rem, 3.75vw, 2.65rem);
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -.035em;
  overflow-wrap: anywhere;
}

.workspace-heading p,
.result-description {
  margin: .8rem 0 0;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.setup-result {
  inline-size: min(100%, 39rem);
  margin-inline: auto;
  padding: clamp(1.4rem, 6vw, 3.8rem);
  border: 1px solid var(--color-panel-border);
  border-radius: 1.25rem;
  background: var(--color-surface);
  text-align: center;
}

.setup-result h1 {
  font-size: clamp(1.45rem, 3.6vw, 2.15rem);
}

.retry-notice {
  margin-block-start: 1.25rem;
  text-align: start;
}

.retry-button {
  margin-block-start: 1.25rem;
}

.status-mark {
  display: grid;
  inline-size: 3.5rem;
  aspect-ratio: 1;
  place-items: center;
  margin: 0 auto 1.2rem;
  border-radius: 50%;
  font-size: 1.65rem;
  font-weight: 700;
}

.attention-mark {
  color: var(--color-error);
  background: var(--color-error-surface);
}

@media (max-width: 48rem) {
  .workspace {
    padding-block-start: clamp(1.35rem, 4vh, 2.75rem);
  }

  .workspace-heading {
    margin-block-end: 1.25rem;
  }

  .workspace-heading p {
    margin-block-start: .55rem;
  }
}
</style>
