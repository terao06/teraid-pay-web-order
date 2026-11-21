import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDeviceSetup } from '../../../../src/features/device-setup/services/createDeviceSetup.js'
import { DeviceRegistrationStorageError } from '../../../../src/shared/device-registration/deviceRegistrationStore.js'

const code = 'ABCD-EFGH-JKLM'
const registration = { device_uuid: 'test-uuid', device_credential: 'test-credential' }

function fixture() {
  const events = []
  let saved = null
  let queue = Promise.resolve()
  const options = {
    async activateDevice(value) {
      events.push(['activate', value])
      return registration
    },
    storage: {
      async load() { return saved },
      async prepare() { events.push(['prepare']) },
      async save(value) {
        events.push(['save', value])
        saved = value
      },
    },
    withActivationLock(work) {
      const result = queue.then(work)
      queue = result.catch(() => {})
      return result
    },
  }
  return { options, events }
}

test('prepares storage and persists registration before activation completes', async () => {
  const { options, events } = fixture()
  const setup = createDeviceSetup(options)

  await setup.activate(code)

  assert.deepEqual(events, [['prepare'], ['activate', code], ['save', registration]])
  assert.deepEqual(await options.storage.load(), registration)
  assert.equal(setup.hasPendingRegistration, false)
})

test('stops before submitting a one-time code if storage cannot be prepared', async () => {
  const { options, events } = fixture()
  options.storage.prepare = async () => { throw new DeviceRegistrationStorageError() }

  await assert.rejects(createDeviceSetup(options).activate(code), DeviceRegistrationStorageError)
  assert.deepEqual(events, [])
})

test('retries the pending save once without resubmitting the activation code', async () => {
  const { options, events } = fixture()
  const save = options.storage.save
  options.storage.save = async () => { throw new DeviceRegistrationStorageError() }
  const setup = createDeviceSetup(options)

  await assert.rejects(setup.activate(code), DeviceRegistrationStorageError)
  assert.equal(setup.hasPendingRegistration, true)
  assert.deepEqual(events, [['prepare'], ['activate', code]])

  options.storage.save = save
  await Promise.all([setup.resumeRegistration(), setup.resumeRegistration()])
  assert.deepEqual(events, [['prepare'], ['activate', code], ['save', registration]])
  assert.equal(setup.hasPendingRegistration, false)
})

test('uses the registration saved by the first tab instead of submitting a second code', async () => {
  const { options, events } = fixture()
  const first = createDeviceSetup(options)
  const second = createDeviceSetup(options)

  await Promise.all([first.activate(code), second.activate('NPQR-STUV-WXYZ')])

  assert.deepEqual(events, [['prepare'], ['activate', code], ['save', registration]])
})
