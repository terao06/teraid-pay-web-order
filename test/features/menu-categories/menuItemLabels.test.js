import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatMenuAmount, optionSelectionLabel } from '../../../src/features/menu-categories/menuItemLabels.js'

test('formats the decimal string without rounding the amount', () => {
  assert.equal(formatMenuAmount('600.000000'), '600')
  assert.equal(formatMenuAmount('1200.500000'), '1,200.5')
  assert.equal(formatMenuAmount('99999999999999.999999'), '99,999,999,999,999.999999')
})

test('shows the available choice range and labels missing options', () => {
  const options = [{}, {}]
  assert.equal(optionSelectionLabel({ min_selections: 0, max_selections: 5, options }), 'お好みで2つまでお選びいただけます')
  assert.equal(optionSelectionLabel({ min_selections: 0, max_selections: 1, options }), 'お好みで1つまでお選びいただけます')
  assert.equal(optionSelectionLabel({ min_selections: 1, max_selections: 1, options }), '必ず選択してください')
  assert.equal(optionSelectionLabel({ min_selections: 1, max_selections: 2, options }), '1〜2つ選択')
  assert.equal(optionSelectionLabel({ min_selections: 2, max_selections: 2, options }), '2つ選択')
  assert.equal(optionSelectionLabel({ min_selections: 3, max_selections: 3, options }), '必要な数のオプションを選べません。')
  assert.equal(optionSelectionLabel({ min_selections: 0, max_selections: 1, options: [] }), '選べるオプションがありません。')
})
