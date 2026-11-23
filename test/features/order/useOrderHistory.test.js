import assert from 'node:assert/strict'
import { test } from 'node:test'
import { useOrderHistory } from '../../../src/features/order/useOrderHistory.js'

test('keeps the newest order history when background requests finish out of order', async () => {
  const requests = []
  const history = useOrderHistory('device', 123, (device, visit) => new Promise((resolve) => {
    requests.push({ device, visit, resolve })
  }))

  const first = history.refresh()
  const second = history.refresh()
  assert.equal(history.loading.value, true)
  assert.deepEqual(requests.map(({ device, visit }) => [device, visit]), [['device', 123], ['device', 123]])
  const orders = [{ menu_order_id: 456 }]
  requests[1].resolve(orders)
  await second
  requests[0].resolve([])
  await first

  assert.deepEqual(history.orders.value, orders)
  assert.equal(history.loading.value, false)
  assert.equal(history.error.value, false)
})

test('keeps loaded orders on error and clears the failure when history is retried', async () => {
  const orders = [{ menu_order_id: 456 }]
  let attempts = 0
  const history = useOrderHistory('device', 123, async () => {
    attempts += 1
    if (attempts === 2) throw new Error('History unavailable')
    return attempts === 1 ? orders : []
  })

  await history.refresh()
  await history.refresh()
  assert.deepEqual(history.orders.value, orders)
  assert.equal(history.error.value, true)
  assert.equal(history.loading.value, false)

  const retry = history.refresh()
  assert.equal(history.error.value, false)
  await retry
  assert.deepEqual(history.orders.value, [])
  assert.equal(history.loading.value, false)
})
