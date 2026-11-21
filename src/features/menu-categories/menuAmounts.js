export function menuAmountToUnits(amount) {
  return BigInt(amount.replace('.', ''))
}

export function unitsToMenuAmount(units) {
  const digits = units.toString().padStart(7, '0')
  return `${digits.slice(0, -6)}.${digits.slice(-6)}`
}
