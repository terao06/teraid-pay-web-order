<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { ApiError } from '../../components/api/apiClient.js'
import { loadMenuCategories } from './menuCategories.js'

const props = defineProps({
  deviceUuid: { type: String, required: true },
  visitSessionId: { type: Number, required: true },
  paymentLabel: { type: String, required: true },
  returning: { type: Boolean, required: true },
  returnError: { type: String, required: true },
})
defineEmits(['return-to-payment'])

const requestErrors = {
  401: '端末を認証できませんでした。店舗スタッフにお声がけください。',
  404: 'この来店セッションでは現在注文を受け付けていません。店舗スタッフにお声がけください。',
  422: '来店セッションを確認できませんでした。店舗スタッフにお声がけください。',
}

const heading = ref(null)
const categories = ref([])
const selectedCategory = ref(null)
const failedImages = ref(new Set())
const loading = ref(true)
const errorMessage = ref('')
let categoryButton

function focusHeading() {
  heading.value?.focus()
}

async function selectCategory(category, event) {
  categoryButton = event.currentTarget
  selectedCategory.value = category
  await nextTick()
  focusHeading()
}

async function returnToCategories() {
  selectedCategory.value = null
  await nextTick()
  categoryButton?.focus()
}

async function loadCategories() {
  focusHeading()
  loading.value = true
  errorMessage.value = ''
  failedImages.value.clear()
  try {
    categories.value = await loadMenuCategories(props.deviceUuid, props.visitSessionId)
  } catch (error) {
    const message = error instanceof ApiError ? requestErrors[error.status] : undefined
    errorMessage.value = message ?? 'カテゴリーを取得できませんでした。接続を確認して再試行してください。'
  } finally {
    loading.value = false
  }
}

onMounted(loadCategories)
</script>

<template>
  <section class="menu-panel" aria-labelledby="menu-categories-title">
    <header class="menu-heading">
      <h1 id="menu-categories-title" ref="heading" tabindex="-1">
        {{ selectedCategory?.name ?? 'カテゴリーを選択' }}
      </h1>
      <p v-if="!selectedCategory">お好きなカテゴリーをタッチしてください。</p>
    </header>

    <p v-if="selectedCategory" class="category-state status-message">商品一覧は準備中です。</p>

    <div v-show="!selectedCategory" class="category-list">
      <div v-if="loading" class="category-state" role="status">カテゴリーを読み込んでいます。</div>
      <div v-else-if="errorMessage" class="category-state">
        <p class="status-message status-message--error" role="alert">{{ errorMessage }}</p>
        <button class="button button--primary menu-action" type="button" @click="loadCategories">再試行</button>
      </div>
      <div v-else-if="categories.length === 0" class="category-state">
        <p class="status-message" role="status">表示できるカテゴリーがありません。</p>
        <button class="button button--secondary menu-action" type="button" @click="loadCategories">再読み込み</button>
      </div>
      <ul v-else class="category-grid">
        <li v-for="category in categories" :key="category.menu_category_id">
          <button class="button category-card" type="button" @click="selectCategory(category, $event)">
            <span class="category-media" aria-hidden="true">
              <img
                v-if="category.image_url && !failedImages.has(category.menu_category_id)"
                :src="category.image_url"
                alt=""
                loading="lazy"
                @error="failedImages.add(category.menu_category_id)"
              >
            </span>
            <span class="category-label">
              <span>{{ category.name }}</span>
              <span class="category-arrow" aria-hidden="true"></span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <p v-if="returnError" class="status-message status-message--error return-error" role="alert">{{ returnError }}</p>
    <footer class="menu-footer">
      <p class="payment-label">
        <span>お支払い方法</span>
        <strong>{{ paymentLabel }}</strong>
      </p>
      <button v-if="selectedCategory" class="button button--primary footer-action" type="button" @click="returnToCategories">
        カテゴリー一覧へ戻る
      </button>
      <button
        v-else
        class="button button--secondary footer-action"
        type="button"
        :disabled="returning"
        @click="$emit('return-to-payment')"
      >
        お支払い方法を変更
      </button>
    </footer>
  </section>
</template>

<style scoped>
.menu-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: clamp(1rem, 2vw, 1.25rem);
  min-inline-size: 0;
}

.menu-heading h1 {
  margin: 0;
  color: var(--color-accent-hover);
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.menu-heading p {
  margin: .45rem 0 0;
  color: var(--color-text-secondary);
  font-size: clamp(.95rem, 1.8vw, 1.125rem);
}

.category-state {
  margin: 0;
  padding: clamp(1rem, 4vw, 2rem);
  border: 1px solid var(--color-panel-border);
  border-radius: 1rem;
  background: var(--color-surface);
}

.category-state > p {
  margin-block-start: 0;
}

.menu-action {
  max-inline-size: 17rem;
  margin-block-start: 1rem;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(.75rem, 1.5vw, 1.25rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.category-card {
  display: grid;
  grid-template-rows: auto 1fr;
  block-size: 100%;
  align-items: stretch;
  justify-content: stretch;
  gap: 0;
  padding: 0;
  border: 1px solid var(--color-panel-border);
  border-radius: 1rem;
  box-shadow: 0 3px 0 #342b1810;
  color: var(--color-accent-hover);
  background: var(--color-input-surface);
  text-align: start;
  scroll-margin-block: 1rem 8rem;
}

.category-card:active {
  background: var(--color-success-surface);
}

.category-media {
  position: relative;
  display: grid;
  aspect-ratio: 1 / 1;
  place-items: center;
  overflow: hidden;
  border-start-start-radius: calc(1rem - 1px);
  border-start-end-radius: calc(1rem - 1px);
  color: #857758;
  background: #ebe3d3;
}

.category-media::before {
  inline-size: 27%;
  aspect-ratio: 1;
  border: 2px solid currentColor;
  border-radius: 50%;
  box-shadow: inset 0 0 0 .45rem #ebe3d3, inset 0 0 0 calc(.45rem + 1px) currentColor;
  content: '';
}

.category-media img {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  background: #ebe3d3;
  object-fit: contain;
}

.category-label {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(.35rem, 1vw, .75rem);
  min-block-size: clamp(3.5rem, 6vw, 4.25rem);
  padding: .65rem clamp(.65rem, 1.4vw, 1rem);
  font-size: clamp(1rem, 2.15vw, 1.4rem);
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.category-arrow {
  display: grid;
  inline-size: clamp(1.4rem, 3vw, 2rem);
  aspect-ratio: 1;
  place-items: center;
  border-radius: 50%;
  color: var(--color-on-accent);
  background: var(--color-accent);
}

.category-arrow::before {
  inline-size: .4em;
  aspect-ratio: 1;
  border-block-start: 2px solid currentColor;
  border-inline-end: 2px solid currentColor;
  transform: translateX(-15%) rotate(45deg);
  content: '';
}

.return-error {
  margin: 0;
}

.menu-footer {
  position: sticky;
  z-index: 1;
  inset-block-end: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .65rem 1rem;
  margin-block-start: auto;
  padding: .7rem clamp(.75rem, 2.5vw, 1.25rem);
  border: 1px solid var(--color-panel-border);
  border-radius: 1rem;
  background: var(--color-surface);
  box-shadow: 0 -3px 12px #342b1812;
}

.payment-label {
  display: grid;
  margin: 0;
  line-height: 1.4;
}

.payment-label span {
  color: var(--color-text-secondary);
  font-size: .85rem;
}

.payment-label strong {
  font-size: 1.075rem;
}

.footer-action {
  inline-size: auto;
  max-inline-size: 100%;
  margin-inline-start: auto;
  padding-inline: clamp(.55rem, 2.5vw, 1.2rem);
  font-size: .95rem;
}

@media (hover: hover) {
  .category-card:hover {
    border-color: var(--color-accent);
  }
}

@media (max-width: 22rem) {
  .category-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (min-width: 43rem) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 66rem) {
  .category-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
