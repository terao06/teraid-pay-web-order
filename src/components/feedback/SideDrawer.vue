<script setup>
import { ref } from 'vue'

const props = defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true },
  tabLabel: { type: String, default: '' },
  closeDisabled: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])
const dialog = ref(null)
const heading = ref(null)

function open(tabOffset = 0) {
  if (!dialog.value || dialog.value.open) return
  dialog.value.style.setProperty('--drawer-tab-offset', `${tabOffset}px`)
  dialog.value.showModal()
}

function close() {
  if (!props.closeDisabled) dialog.value?.close()
}

defineExpose({
  open,
  close,
  isOpen: () => Boolean(dialog.value?.open),
  focusHeading: () => heading.value?.focus(),
})
</script>

<template>
  <dialog
    :id="id"
    ref="dialog"
    class="side-drawer"
    :aria-labelledby="`${id}-title`"
    @click.self="close"
    @cancel.prevent="close"
    @close.self="emit('close')"
  >
    <button
      class="button edge-tab drawer-tab"
      type="button"
      :aria-controls="id"
      aria-expanded="true"
      :disabled="closeDisabled"
      @click="close"
    >
      <span class="edge-tab-label">{{ tabLabel || title }}</span>
      <slot name="tab-badge" />
    </button>
    <div class="drawer-panel">
      <header class="drawer-header">
        <h2 :id="`${id}-title`" ref="heading" tabindex="-1">{{ title }}</h2>
        <button class="button button--secondary drawer-close" type="button" :disabled="closeDisabled" autofocus @click="close">
          閉じる
        </button>
      </header>
      <div class="drawer-content">
        <slot />
      </div>
      <slot name="footer" />
    </div>
    <slot name="feedback" />
  </dialog>
</template>

<style scoped>
:global(html:has(.side-drawer[open])) {
  overflow: hidden;
  scrollbar-gutter: stable;
}

.side-drawer {
  position: fixed;
  inset-block: 0;
  inset-inline: auto 0;
  inline-size: min(calc(100% - var(--menu-tab-width)), 28rem);
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

.drawer-tab {
  position: absolute;
  inset-block-start: calc(var(--menu-tabs-top) + var(--drawer-tab-offset, 0px));
  inset-inline-end: 100%;
  inline-size: var(--menu-tab-width);
}

.side-drawer::backdrop {
  background: #1b292180;
}

.drawer-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  block-size: 100%;
  background: var(--color-background);
  box-shadow: -8px 0 28px #242b2333;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  padding: .9rem clamp(.8rem, 3vw, 1.35rem);
  border-block-end: 1px solid var(--color-panel-border);
  background: var(--color-surface);
}

.drawer-header h2 {
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

@media (prefers-reduced-motion: no-preference) {
  @supports not (overlay: auto) {
    .side-drawer[open] {
      animation: open-side-drawer var(--drawer-slide-duration) ease-out;
    }
  }

  @supports (overlay: auto) {
    .side-drawer {
      transform: translateX(100%);
      transition:
        transform var(--drawer-slide-duration) ease-out,
        display var(--drawer-slide-duration) allow-discrete,
        overlay var(--drawer-slide-duration) allow-discrete;
    }

    .side-drawer[open] {
      transform: translateX(0);
    }

    .side-drawer:not([open]) {
      pointer-events: none;
    }

    @starting-style {
      .side-drawer[open] {
        transform: translateX(100%);
      }
    }
  }
}

@keyframes open-side-drawer {
  from { transform: translateX(100%); }
}
</style>
