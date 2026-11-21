export function createDeviceSetup({ activateDevice, storage, withActivationLock }) {
  let pendingRegistration

  async function savePendingRegistration() {
    if (!pendingRegistration) return

    await storage.save(pendingRegistration)
    pendingRegistration = undefined
  }

  return {
    get hasPendingRegistration() {
      return Boolean(pendingRegistration)
    },

    async resumeRegistration() {
      if (pendingRegistration) await withActivationLock(savePendingRegistration)
    },

    async activate(code) {
      await withActivationLock(async () => {
        if (!pendingRegistration) {
          // Another tab may have registered this browser while it was waiting for the lock.
          if (await storage.load()) return

          await storage.prepare()
          pendingRegistration = await activateDevice(code)
        }
        await savePendingRegistration()
      })
    },
  }
}
