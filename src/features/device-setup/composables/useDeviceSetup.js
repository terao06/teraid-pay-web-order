import { onMounted, onUnmounted, ref } from 'vue'
import { ApiError } from '../../../components/api/apiClient.js'
import { DeviceRegistrationStorageError } from '../../../shared/device-registration/deviceRegistrationStore.js'
import { deviceSession } from '../../device-auth/deviceSession.js'
import { deviceSetup, supportsDeviceActivation } from '../deviceSetup.js'
import { SETUP_MESSAGES } from '../setupMessages.js'

const MAX_TIMER_DELAY_MS = 2_147_483_647

export const SETUP_PHASE = {
  checking: 'checking',
  setup: 'setup',
  activating: 'activating',
  ready: 'ready',
  retry: 'retry',
}

function authenticationMessage(failure) {
  return failure instanceof ApiError && failure.status === 401
    ? SETUP_MESSAGES.authenticationRejected
    : SETUP_MESSAGES.authenticationFailed
}

export function useDeviceSetup() {
  const phase = ref(SETUP_PHASE.checking)
  const deviceUuid = ref('')
  const errorMessage = ref('')
  const invalidCode = ref(false)
  let refreshTimer
  let refreshAt
  let mounted = false
  let checking = false

  function showReady(token) {
    if (!mounted) return

    deviceUuid.value = token.deviceUuid
    phase.value = SETUP_PHASE.ready
    refreshAt = token.refreshAt
    clearTimeout(refreshTimer)
    const delay = Math.max(0, refreshAt - Date.now())
    refreshTimer = setTimeout(checkRegistration, Math.min(MAX_TIMER_DELAY_MS, delay))
  }

  function showRetry(message) {
    clearTimeout(refreshTimer)
    phase.value = SETUP_PHASE.retry
    errorMessage.value = message
  }

  async function checkRegistration() {
    if (checking) return

    checking = true
    if (phase.value !== SETUP_PHASE.ready && phase.value !== SETUP_PHASE.activating) {
      phase.value = SETUP_PHASE.checking
    }
    errorMessage.value = ''
    try {
      await deviceSetup.resumeRegistration()
      const token = await deviceSession.getAccessToken()
      if (token) {
        showReady(token)
        return
      }

      if (!supportsDeviceActivation()) throw new DeviceRegistrationStorageError()
      phase.value = SETUP_PHASE.setup
    } catch (failure) {
      if (deviceSetup.hasPendingRegistration) {
        showRetry(SETUP_MESSAGES.registrationSaveFailed)
      } else if (failure instanceof DeviceRegistrationStorageError) {
        showRetry(SETUP_MESSAGES.storageUnavailable)
      } else {
        showRetry(authenticationMessage(failure))
      }
    } finally {
      checking = false
    }
  }

  function clearError() {
    errorMessage.value = ''
    invalidCode.value = false
  }

  async function activate(code) {
    if (phase.value !== SETUP_PHASE.setup) return

    clearError()
    phase.value = SETUP_PHASE.activating
    try {
      await deviceSetup.activate(code)
    } catch (failure) {
      if (deviceSetup.hasPendingRegistration) {
        showRetry(SETUP_MESSAGES.registrationSaveFailed)
        return
      }

      phase.value = SETUP_PHASE.setup
      if (failure instanceof DeviceRegistrationStorageError) {
        errorMessage.value = SETUP_MESSAGES.storageUnavailable
        return
      }

      const message = failure instanceof ApiError ? SETUP_MESSAGES.activationInputErrors[failure.status] : undefined
      invalidCode.value = Boolean(message)
      errorMessage.value = message ?? SETUP_MESSAGES.activationResultUnknown
      return
    }

    await checkRegistration()
  }

  function onVisibilityChange() {
    if (!document.hidden && phase.value === SETUP_PHASE.ready && Date.now() >= refreshAt) {
      checkRegistration()
    }
  }

  onMounted(() => {
    mounted = true
    document.addEventListener('visibilitychange', onVisibilityChange)
    checkRegistration()
  })

  onUnmounted(() => {
    mounted = false
    clearTimeout(refreshTimer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { phase, deviceUuid, errorMessage, invalidCode, checkRegistration, activate, clearError }
}
