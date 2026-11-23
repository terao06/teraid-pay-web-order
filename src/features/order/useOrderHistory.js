import { ref } from 'vue'
import { loadOrderHistory } from './orderHistory.js'

export function useOrderHistory(deviceUuid, visitSessionId, load = loadOrderHistory) {
  const orders = ref([])
  const loading = ref(false)
  const error = ref(false)
  let latestRequest = 0

  async function refresh() {
    const request = ++latestRequest
    loading.value = true
    error.value = false
    try {
      const result = await load(deviceUuid, visitSessionId)
      if (request === latestRequest) orders.value = result
    } catch {
      if (request === latestRequest) error.value = true
    } finally {
      if (request === latestRequest) loading.value = false
    }
  }

  return { orders, loading, error, refresh }
}
