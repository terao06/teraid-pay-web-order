export function formatMenuAmount(amount) {
  const [whole, fraction] = amount.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimals = fraction.replace(/0+$/, '')
  return decimals ? `${grouped}.${decimals}` : grouped
}

export function optionSelectionLabel({ min_selections: min, max_selections: max, options }) {
  if (!options.length) return '選べるオプションがありません。'
  const availableMax = Math.min(max, options.length)
  if (min > availableMax) return '必要な数のオプションを選べません。'
  if (min === 1 && availableMax === 1) return '必ず選択してください'
  if (min === availableMax) return `${min}つ選択`
  if (min === 0) return `お好みで${availableMax}つまでお選びいただけます`
  return `${min}〜${availableMax}つ選択`
}
