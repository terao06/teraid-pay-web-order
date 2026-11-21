<script setup>
import { formatMenuAmount } from '../menu-categories/menuItemLabels.js'

defineProps({
  quantity: { type: Number, required: true },
  totals: { type: Array, required: true },
})
</script>

<template>
  <p class="cart-summary" role="status" aria-atomic="true">
    <span>合計 {{ quantity }}点</span>
    <strong v-for="{ tokenSymbol, amount } in totals" :key="tokenSymbol">
      {{ formatMenuAmount(amount) }} {{ tokenSymbol }}
    </strong>
  </p>
</template>

<style scoped>
.cart-summary {
  display: grid;
  gap: var(--cart-summary-gap, 0);
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.4;
}

span {
  color: var(--color-text-secondary);
  font-size: var(--cart-summary-label-size, .85rem);
}

strong {
  color: var(--cart-summary-amount-color, var(--color-text));
  font-size: var(--cart-summary-amount-size, 1.075rem);
  font-variant-numeric: tabular-nums;
}
</style>
