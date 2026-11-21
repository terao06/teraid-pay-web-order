import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addCartItem, cartLineAmount, cartTotals, MAX_CART_QUANTITY, removeCartItem, setCartQuantity } from '../../../src/features/cart/cart.js'

const item = {
  menu_item_id: 10,
  name: '牛丼',
  token_symbol: 'JPYC',
  price: '500.000001',
  option_groups: [{
    menu_option_group_id: 20,
    name: 'トッピング',
    min_selections: 1,
    max_selections: 2,
    options: [
      { menu_option_id: 30, name: 'ねぎ', additional_price: '25.000001' },
      { menu_option_id: 31, name: '卵', additional_price: '50.000003' },
    ],
  }],
}
const choose = (...ids) => new Map([[20, ids]])

test('adds a snapshot only when the required toppings are selected', () => {
  const lines = []
  assert.equal(addCartItem(lines, item, choose()), lines)
  assert.equal(addCartItem(lines, item, choose(99)), lines)
  const [line] = addCartItem(lines, item, choose(30))
  assert.equal(line.itemId, 10)
  assert.equal(line.unitPrice, '525.000002')
  assert.equal(line.quantity, 1)
  assert.deepEqual(line.options, [{ id: 30, groupName: 'トッピング', name: 'ねぎ', additionalPrice: '25.000001' }])
})

test('merges the same menu item and toppings irrespective of selection order', () => {
  const one = addCartItem([], item, choose(30, 31))
  const two = addCartItem(one, item, choose(31, 30))
  assert.equal(two.length, 1)
  assert.equal(two[0].quantity, 2)
  assert.equal(one[0].quantity, 1)

  const separateToppings = addCartItem(two, item, choose(30))
  assert.equal(separateToppings.length, 2)
  assert.equal(separateToppings[1].quantity, 1)
  const repricedItem = { ...item, price: '600.000000' }
  assert.equal(addCartItem(separateToppings, repricedItem, choose(30)).length, 3)
})

test('updates quantities and removes only the specified line', () => {
  const lines = addCartItem(addCartItem([], item, choose(30)), item, choose(31))
  const [first, second] = lines
  for (const quantity of [0, 1.5, MAX_CART_QUANTITY + 1]) {
    assert.equal(setCartQuantity(lines, first.key, quantity), lines)
  }
  const updated = setCartQuantity(lines, first.key, 3)
  assert.deepEqual(updated.map(({ quantity }) => quantity), [3, 1])
  assert.deepEqual(removeCartItem(updated, first.key), [second])
})

test('preserves decimal precision and keeps totals separate by payment token', () => {
  const [line] = addCartItem([], item, choose(30))
  const lines = [{ ...line, quantity: 3 }, line, { ...line, tokenSymbol: 'USDC', unitPrice: '0.000001', quantity: 2 }]
  assert.equal(cartLineAmount(lines[0]), '1575.000006')
  assert.deepEqual(cartTotals(lines), [
    { tokenSymbol: 'JPYC', amount: '2100.000008' },
    { tokenSymbol: 'USDC', amount: '0.000002' },
  ])
  assert.deepEqual(cartTotals([]), [])
})
