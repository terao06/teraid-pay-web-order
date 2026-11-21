import { menuAmountToUnits, unitsToMenuAmount } from '../menu-categories/menuAmounts.js'
import { calculateMenuSubtotal, hasValidMenuOptions, selectedGroupOptions } from '../menu-categories/menuItemSelection.js'

export const MAX_CART_QUANTITY = 4_294_967_295

export function addCartItem(lines, item, selections) {
  if (!hasValidMenuOptions(item, selections)) return lines

  const options = item.option_groups.flatMap((group) => selectedGroupOptions(group, selections).map((option) => ({
    id: option.menu_option_id,
    name: option.name,
    groupName: group.name,
    additionalPrice: option.additional_price,
  })))
  const unitPrice = calculateMenuSubtotal(item, selections)
  const optionPrices = options.map(({ id, additionalPrice }) => [id, additionalPrice]).sort(([a], [b]) => a - b)
  const key = JSON.stringify([item.menu_item_id, item.token_symbol, item.price, optionPrices])
  const existing = lines.find((line) => line.key === key)
  if (existing) return setCartQuantity(lines, key, existing.quantity + 1)

  return [...lines, {
    key,
    itemId: item.menu_item_id,
    name: item.name,
    tokenSymbol: item.token_symbol,
    unitPrice,
    options,
    quantity: 1,
  }]
}

export function setCartQuantity(lines, key, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_QUANTITY) return lines
  return lines.map((line) => line.key === key ? { ...line, quantity } : line)
}

export function removeCartItem(lines, key) {
  return lines.filter((line) => line.key !== key)
}

function cartLineUnits(line) {
  return menuAmountToUnits(line.unitPrice) * BigInt(line.quantity)
}

export function cartLineAmount(line) {
  return unitsToMenuAmount(cartLineUnits(line))
}

export function cartTotals(lines) {
  const totals = new Map()
  for (const line of lines) {
    totals.set(line.tokenSymbol, (totals.get(line.tokenSymbol) ?? 0n) + cartLineUnits(line))
  }
  return Array.from(totals, ([tokenSymbol, units]) => ({ tokenSymbol, amount: unitsToMenuAmount(units) }))
}
