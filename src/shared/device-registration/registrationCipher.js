import { isDeviceRegistration } from './registration.js'

const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12

export function createRegistrationKey() {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: 256 }, false, ['encrypt', 'decrypt'])
}

async function encrypt(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, plaintext)
  return { iv, ciphertext }
}

export async function verifyRegistrationKey(key) {
  await encrypt(new Uint8Array(), key)
}

export function encryptRegistration(registration, key) {
  const plaintext = new TextEncoder().encode(JSON.stringify(registration))
  return encrypt(plaintext, key)
}

export async function decryptRegistration({ iv, ciphertext }, key) {
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext)
  const registration = JSON.parse(new TextDecoder().decode(plaintext))
  if (!isDeviceRegistration(registration)) throw new Error('Invalid stored device registration')
  return registration
}
