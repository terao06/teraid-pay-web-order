<script setup>
import { onMounted, ref } from 'vue'
import { ApiError } from '../../components/api/apiClient.js'
import MenuItemPhoto from './MenuItemPhoto.vue'
import { loadMenuItems } from './menuCategories.js'
import { formatMenuAmount } from './menuItemLabels.js'

const props = defineProps({
  deviceUuid: { type: String, required: true },
  categoryId: { type: Number, required: true },
  visitSessionId: { type: Number, required: true },
})
const emit = defineEmits(['unavailable', 'select-item'])

const requestErrors = {
  401: '端末を認証できませんでした。店舗スタッフにお声がけください。',
  404: 'このカテゴリーを表示できません。カテゴリー一覧に戻って選び直してください。',
  422: '注文の情報を確認できませんでした。店舗スタッフにお声がけください。',
}

const results = ref(null)
const items = ref([])
const loading = ref(true)
const errorMessage = ref('')
const unavailable = ref(false)

async function loadItems() {
  loading.value = true
  errorMessage.value = ''

  try {
    items.value = await loadMenuItems(props.deviceUuid, props.categoryId, props.visitSessionId)
  } catch (error) {
    const status = error instanceof ApiError ? error.status : undefined
    unavailable.value = status === 404
    errorMessage.value = requestErrors[status] ?? '商品を取得できませんでした。接続を確認して再試行してください。'
    if (unavailable.value) emit('unavailable')
  } finally {
    loading.value = false
  }
}

function retry() {
  results.value?.focus()
  return loadItems()
}

onMounted(loadItems)
</script>

<template>
  <div ref="results" class="menu-results" tabindex="-1">
    <p v-if="loading" class="item-state" role="status">商品を読み込んでいます。</p>
    <div v-else-if="errorMessage" class="item-state">
      <p class="status-message status-message--error" role="alert">{{ errorMessage }}</p>
      <button v-if="!unavailable" type="button" class="button button--primary retry-action" @click="retry">
        再試行
      </button>
    </div>
    <p v-else-if="!items.length" class="item-state" role="status">現在販売中の商品はありません。</p>
    <ul v-else class="item-grid">
      <li v-for="item in items" :key="item.menu_item_id">
        <button class="button item-card" type="button" @click="emit('select-item', item, $event.currentTarget)">
          <MenuItemPhoto :src="item.image_url" class="item-photo" />
          <span class="item-content">
            <span class="item-name">{{ item.name }}</span>
            <span class="item-price"><strong>{{ formatMenuAmount(item.price) }}</strong> {{ item.token_symbol }}</span>
            <span class="item-arrow" aria-hidden="true"></span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.item-state {
  margin: 0;
  padding: clamp(1rem, 4vw, 2rem);
  border: 1px solid var(--color-panel-border);
  border-radius: 1rem;
  background: var(--color-surface);
}

.item-state .status-message {
  margin: 0;
}

.retry-action {
  max-inline-size: 17rem;
  margin-block-start: 1rem;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
  gap: clamp(.75rem, 1.5vw, 1.25rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.item-card {
  display: grid;
  grid-template-rows: auto 1fr;
  block-size: 100%;
  align-items: stretch;
  justify-content: stretch;
  gap: 0;
  padding: 0;
  overflow-wrap: anywhere;
  border: 1px solid var(--color-panel-border);
  border-radius: 1rem;
  color: var(--color-accent-hover);
  background: var(--color-input-surface);
  box-shadow: 0 3px 0 #342b1810;
  text-align: start;
  scroll-margin-block: 1rem 8rem;
}

.item-card:active {
  background: var(--color-success-surface);
}

.item-photo {
  border-start-start-radius: calc(1rem - 1px);
  border-start-end-radius: calc(1rem - 1px);
}

.item-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'name arrow' 'price arrow';
  align-content: center;
  align-items: center;
  gap: .2rem .65rem;
  padding: clamp(.75rem, 2vw, 1.25rem);
}

.item-name {
  grid-area: name;
  font-weight: 800;
}

.item-name,
.item-price strong {
  font-size: clamp(1.125rem, 2vw, 1.375rem);
  line-height: 1.35;
}

.item-price {
  grid-area: price;
  color: var(--color-text-secondary);
  font-weight: 400;
}

.item-price strong {
  color: var(--color-accent-hover);
  font-variant-numeric: tabular-nums;
}

.item-arrow {
  display: grid;
  grid-area: arrow;
  inline-size: 1.65rem;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 50%;
  color: var(--color-on-accent);
  background: var(--color-accent);
}

.item-arrow::before {
  inline-size: .4em;
  aspect-ratio: 1;
  border-block-start: 2px solid currentColor;
  border-inline-end: 2px solid currentColor;
  transform: translateX(-15%) rotate(45deg);
  content: '';
}

@media (hover: hover) {
  .item-card:hover {
    border-color: var(--color-accent);
  }
}
</style>
