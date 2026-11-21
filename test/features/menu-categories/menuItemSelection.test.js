import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateMenuSubtotal, toggleMenuOption } from '../../../src/features/menu-categories/menuItemSelection.js'

test('switches the choice in a single-selection group and allows clearing it', () => {
  const group = { max_selections: 1 }
  assert.deepEqual(toggleMenuOption(group, [], 12), [12])
  assert.deepEqual(toggleMenuOption(group, [12], 13), [13])
  assert.deepEqual(toggleMenuOption(group, [13], 13), [])
})

test('limits multiple selections and allows deselecting at the limit', () => {
  const group = { max_selections: 2 }
  assert.deepEqual(toggleMenuOption(group, [12], 13), [12, 13])
  assert.deepEqual(toggleMenuOption(group, [12, 13], 14), [12, 13])
  assert.deepEqual(toggleMenuOption(group, [12, 13], 12), [13])
})

test('adds selected toppings across groups exactly to six decimal places', () => {
  const item = {
    price: '99999999999999.999999',
    option_groups: [
      {
        menu_option_group_id: 1,
        options: [
          { menu_option_id: 12, additional_price: '0.000001' },
          { menu_option_id: 13, additional_price: '5.500000' },
        ],
      },
      { menu_option_group_id: 2, options: [{ menu_option_id: 14, additional_price: '0.250000' }] },
    ],
  }

  assert.equal(calculateMenuSubtotal(item, new Map()), item.price)
  assert.equal(calculateMenuSubtotal(item, new Map([[1, [12]], [2, [14]]])), '100000000000000.250000')
  assert.equal(calculateMenuSubtotal({ price: '0.000001', option_groups: [] }, new Map()), '0.000001')
})
