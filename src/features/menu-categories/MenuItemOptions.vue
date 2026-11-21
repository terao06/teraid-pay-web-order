<script setup>
import { computed } from 'vue'
import MenuItemPhoto from './MenuItemPhoto.vue'
import { formatMenuAmount, optionSelectionLabel } from './menuItemLabels.js'
import { toggleMenuOption } from './menuItemSelection.js'

const props = defineProps({ item: { type: Object, required: true } })
const selections = defineModel({ type: Map, required: true })

const groups = computed(() => props.item.option_groups.map((group) => ({
  ...group,
  selectedIds: selections.value.get(group.menu_option_group_id) ?? [],
})))

function selectOption(group, optionId) {
  const next = new Map(selections.value)
  next.set(group.menu_option_group_id, toggleMenuOption(group, group.selectedIds, optionId))
  selections.value = next
}
</script>

<template>
  <div class="topping-layout">
    <div class="item-summary">
      <MenuItemPhoto :src="item.image_url" class="summary-photo" />
      <p class="base-price">
        <span>基本価格</span>
        <strong>{{ formatMenuAmount(item.price) }} {{ item.token_symbol }}</strong>
      </p>
    </div>

    <div class="topping-groups">
      <p v-if="!groups.length" class="topping-group">この商品に選べるトッピングはありません。</p>
      <section
        v-for="group in groups"
        :key="group.menu_option_group_id"
        class="topping-group"
        :aria-labelledby="`topping-group-${group.menu_option_group_id}`"
      >
        <header class="topping-header">
          <div>
            <h2 :id="`topping-group-${group.menu_option_group_id}`">{{ group.name }}</h2>
            <p>{{ optionSelectionLabel(group) }}</p>
          </div>
          <p v-if="group.options.length" class="selection-count">
            {{ group.selectedIds.length }} / {{ Math.min(group.max_selections, group.options.length) }} 選択済み
          </p>
        </header>

        <ul v-if="group.options.length" class="topping-list">
          <li v-for="option in group.options" :key="option.menu_option_id">
            <button
              class="button button--secondary topping-option"
              type="button"
              :aria-pressed="group.selectedIds.includes(option.menu_option_id)"
              :disabled="group.max_selections > 1 && group.selectedIds.length >= group.max_selections && !group.selectedIds.includes(option.menu_option_id)"
              @click="selectOption(group, option.menu_option_id)"
            >
              <span class="topping-check" aria-hidden="true"></span>
              <span class="topping-option-name">{{ option.name }}</span>
              <span v-if="option.additional_price === '0.000000'" class="topping-price">追加料金なし</span>
              <span v-else class="topping-price">+{{ formatMenuAmount(option.additional_price) }} {{ item.token_symbol }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.topping-layout {
  display: grid;
  align-items: start;
  gap: clamp(.75rem, 2vw, 1.25rem);
}

.item-summary {
  display: grid;
  grid-template-columns: minmax(0, 7rem) minmax(0, 1fr);
  align-items: center;
  overflow: hidden;
}

.item-summary,
.topping-group {
  border: 1px solid var(--color-panel-border);
  border-radius: 1rem;
  background: var(--color-surface);
}

.base-price {
  display: grid;
  gap: .25rem;
  margin: 0;
  padding: .75rem 1rem;
  overflow-wrap: anywhere;
  line-height: 1.4;
}

.base-price span,
.topping-header p,
.topping-price,
.topping-required {
  color: var(--color-text-secondary);
  font-size: .875rem;
}

.base-price strong {
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
}

.topping-groups {
  display: grid;
  gap: 1rem;
  min-inline-size: 0;
}

.topping-group {
  margin: 0;
  padding: clamp(1rem, 3vw, 1.5rem);
  overflow-wrap: anywhere;
}

.topping-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: .35rem 1rem;
}

.topping-header h2,
.topping-header p {
  margin: 0;
}

.topping-header h2 {
  font-size: clamp(1.15rem, 2.2vw, 1.45rem);
  line-height: 1.35;
}

.topping-header .selection-count {
  color: var(--color-accent);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.topping-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  gap: .7rem;
  margin: .85rem 0 0;
  padding: 0;
  list-style: none;
}

.topping-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas: 'check name' 'check price';
  block-size: 100%;
  justify-content: stretch;
  column-gap: .65rem;
  row-gap: .15rem;
  padding: .65rem .75rem;
  text-align: start;
  scroll-margin-block: 1rem 8rem;
}

.topping-option[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--color-success-surface);
}

.topping-option:disabled {
  cursor: default;
}

.topping-check {
  display: grid;
  grid-area: check;
  inline-size: 1.3rem;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: .35rem;
  color: var(--color-accent);
}

.topping-option[aria-pressed='true'] .topping-check {
  color: var(--color-on-accent);
  background: var(--color-accent);
}

.topping-option[aria-pressed='true'] .topping-check::before {
  inline-size: .55rem;
  block-size: .3rem;
  border: solid currentColor;
  border-width: 0 0 2px 2px;
  transform: translateY(-1px) rotate(-45deg);
  content: '';
}

.topping-option-name {
  grid-area: name;
}

.topping-price {
  grid-area: price;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.topping-required {
  margin: .75rem 0 0;
}

@media (min-width: 46rem) {
  .topping-layout {
    grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
  }

  .item-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
