import { menuAmountToUnits, unitsToMenuAmount } from './menuAmounts.js'

export function toggleMenuOption(group, selectedIds, optionId) {
  if (selectedIds.includes(optionId)) return selectedIds.filter((id) => id !== optionId)
  if (group.max_selections === 1) return [optionId]
  if (selectedIds.length >= group.max_selections) return selectedIds
  return [...selectedIds, optionId]
}

export function selectedGroupOptions(group, selections) {
  const ids = selections.get(group.menu_option_group_id) ?? []
  return group.options.filter((option) => ids.includes(option.menu_option_id))
}

export function hasValidMenuOptions(item, selections) {
  return item.option_groups.every((group) => {
    const count = selectedGroupOptions(group, selections).length
    return count >= group.min_selections && count <= group.max_selections
  })
}

export function calculateMenuSubtotal(item, selections) {
  let total = menuAmountToUnits(item.price)
  for (const group of item.option_groups) {
    for (const option of selectedGroupOptions(group, selections)) {
      total += menuAmountToUnits(option.additional_price)
    }
  }
  return unitsToMenuAmount(total)
}
