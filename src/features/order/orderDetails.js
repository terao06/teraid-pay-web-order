function isQuantity(value) {
  return Number.isSafeInteger(value) && value > 0
}

export function isOrderAmount(value) {
  return typeof value === 'string' && /^-?\d{1,14}\.\d{6}$/.test(value)
}

function isOption(option) {
  return typeof option?.option_group_name === 'string'
    && typeof option.option_name === 'string'
    && isOrderAmount(option.additional_price)
    && isQuantity(option.option_quantity)
}

export function isOrderItem(item) {
  return typeof item?.menu_item_name === 'string'
    && isQuantity(item.quantity)
    && isOrderAmount(item.unit_price)
    && isOrderAmount(item.line_amount)
    && Array.isArray(item.options)
    && item.options.every(isOption)
}
