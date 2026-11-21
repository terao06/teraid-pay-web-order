<script setup>
import { ref } from 'vue'

defineProps({ src: { type: String, required: true } })

const failedUrl = ref('')
</script>

<template>
  <span class="item-media" aria-hidden="true">
    <img v-if="src && src !== failedUrl" :src="src" alt="" loading="lazy" @error="failedUrl = src">
  </span>
</template>

<style scoped>
.item-media {
  position: relative;
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #ebe3d3;
}

img {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}
</style>
