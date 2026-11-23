<script setup>
import { ref } from 'vue'
import SideDrawer from '../../components/feedback/SideDrawer.vue'
import { formatMenuAmount } from '../menu-categories/menuItemLabels.js'
import { ORDER_STATUS_LABELS } from './orderHistoryEntry.js'

defineProps({
  orders: { type: Array, required: true },
  loading: { type: Boolean, required: true },
  error: { type: Boolean, required: true },
  latestOrderId: { type: Number, default: null },
})
const emit = defineEmits(['close', 'retry'])
const drawer = ref(null)
const dateTime = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'short' })

defineExpose({ open: (tabOffset) => drawer.value?.open(tabOffset) })
</script>

<template>
  <SideDrawer id="order-history-dialog" ref="drawer" title="注文履歴" @close="emit('close')">
    <p v-if="loading" class="status-message" role="status">注文履歴を取得しています。</p>
    <div v-else-if="error">
      <p class="status-message status-message--error" role="alert">
        {{ latestOrderId ? 'ご注文は受け付け済みです。' : '' }}注文履歴を取得できませんでした。
      </p>
      <button class="button button--secondary retry-history" type="button" @click="emit('retry')">
        履歴の取得を再試行
      </button>
    </div>
    <p v-else-if="!orders.length" class="status-message">注文はまだありません。</p>
    <ol v-if="orders.length" class="orders">
      <li v-for="order in orders" :key="order.menu_order_id" class="order">
        <h3>注文番号 {{ order.menu_order_id }}</h3>
        <p class="order-meta">
          <span v-if="order.menu_order_id === latestOrderId">今回の注文</span>
          <time :datetime="order.created_at">{{ dateTime.format(new Date(order.created_at)) }}</time>
          <span>{{ ORDER_STATUS_LABELS[order.status] }}</span>
        </p>
        <ul v-if="order.items.length" class="items">
          <li v-for="(item, index) in order.items" :key="index">
            <div class="amount-row">
              <span>{{ item.menu_item_name }} × {{ item.quantity }}</span>
              <span>{{ formatMenuAmount(item.line_amount) }} {{ order.token_symbol }}</span>
            </div>
            <ul v-if="item.options.length" class="options">
              <li v-for="(option, optionIndex) in item.options" :key="optionIndex">
                {{ option.option_group_name }} / {{ option.option_name }} × {{ option.option_quantity }}
              </li>
            </ul>
          </li>
        </ul>
        <div class="amount-row total">
          <span>注文合計</span>
          <strong>{{ formatMenuAmount(order.total_amount) }} {{ order.token_symbol }}</strong>
        </div>
      </li>
    </ol>
  </SideDrawer>
</template>

<style scoped>
.orders, .items {
  display: grid;
  gap: .65rem;
  padding: 0;
  list-style: none;
}

.orders, .status-message {
  margin: 0;
}

.orders:not(:first-child) {
  margin-block-start: .8rem;
}

.order {
  padding: .75rem;
  border: 1px solid var(--color-panel-border);
  border-radius: var(--control-radius);
}

.order h3 {
  margin: 0;
  font-size: 1rem;
}

.order-meta, .amount-row {
  display: flex;
  flex-wrap: wrap;
  gap: .25rem .75rem;
  font-variant-numeric: tabular-nums;
}

.order-meta {
  margin: .2rem 0 0;
}

.order-meta, .options {
  color: var(--color-text-secondary);
  font-size: .875rem;
}

.options {
  padding-inline-start: 1.25rem;
}

.amount-row {
  justify-content: space-between;
}

.total {
  margin-block-start: .65rem;
  padding-block-start: .5rem;
  border-block-start: 1px solid var(--color-panel-border);
}

.retry-history {
  margin-block-start: .65rem;
}
</style>
