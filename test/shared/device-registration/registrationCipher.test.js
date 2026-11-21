import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createRegistrationKey, decryptRegistration, encryptRegistration, verifyRegistrationKey,
} from '../../../src/shared/device-registration/registrationCipher.js'

const registration = {
  device_uuid: '81004100-0000-4000-8000-000000000041',
  device_credential: 'test-device-credential',
}

test('round-trips registration using a non-extractable key and a new IV for each encryption', async () => {
  const key = await createRegistrationKey()
  assert.equal(key.extractable, false)
  await verifyRegistrationKey(key)

  const first = await encryptRegistration(registration, key)
  const second = await encryptRegistration(registration, key)
  assert.ok(first.ciphertext instanceof ArrayBuffer)
  assert.notDeepEqual(first.iv, second.iv)
  assert.deepEqual(await decryptRegistration(first, key), registration)
})

test('rejects altered ciphertext and decrypted data that cannot be used to authenticate a device', async () => {
  const key = await createRegistrationKey()
  const encrypted = await encryptRegistration(registration, key)
  const bytes = new Uint8Array(encrypted.ciphertext)
  bytes[0] ^= 1
  await assert.rejects(decryptRegistration(encrypted, key), { name: 'OperationError' })

  const invalid = await encryptRegistration({ device_uuid: registration.device_uuid }, key)
  await assert.rejects(decryptRegistration(invalid, key), /Invalid stored device registration/)
})
