import {
  createRegistrationKey, decryptRegistration, encryptRegistration, verifyRegistrationKey,
} from './registrationCipher.js'

const DATABASE_NAME = 'teraid-pay-order'
const DATABASE_VERSION = 1
const DEVICE_STORE = 'device'
const KEY_RECORD = 'key'
const REGISTRATION_RECORD = 'registration'

export class DeviceRegistrationStorageError extends Error {
  constructor() {
    super('Device registration storage unavailable')
    this.name = 'DeviceRegistrationStorageError'
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => request.result.createObjectStore(DEVICE_STORE)
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(request.error)
  })
}

function readRecord(database, name) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(DEVICE_STORE).objectStore(DEVICE_STORE).get(name)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function addRecord(database, name, value) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DEVICE_STORE, 'readwrite')
    transaction.oncomplete = resolve
    transaction.onabort = () => reject(transaction.error)
    transaction.objectStore(DEVICE_STORE).add(value, name)
  })
}

function createDeviceRegistrationStore() {
  let connection
  let encryptionKey

  async function withDatabase(work) {
    if (!globalThis.isSecureContext || !globalThis.indexedDB || !globalThis.crypto?.subtle) {
      throw new DeviceRegistrationStorageError()
    }

    try {
      connection ??= openDatabase().catch((error) => {
        connection = undefined
        throw error
      })
      return await work(await connection)
    } catch {
      throw new DeviceRegistrationStorageError()
    }
  }

  return {
    prepare() {
      return withDatabase(async (db) => {
        encryptionKey ??= await readRecord(db, KEY_RECORD)
        if (!encryptionKey) {
          const key = await createRegistrationKey()
          await addRecord(db, KEY_RECORD, key)
          encryptionKey = await readRecord(db, KEY_RECORD)
        }

        await verifyRegistrationKey(encryptionKey)
      })
    },

    load() {
      return withDatabase(async (db) => {
        const encrypted = await readRecord(db, REGISTRATION_RECORD)
        if (!encrypted) return null

        encryptionKey ??= await readRecord(db, KEY_RECORD)
        return decryptRegistration(encrypted, encryptionKey)
      })
    },

    save(registration) {
      return withDatabase(async (db) => {
        const encrypted = await encryptRegistration(registration, encryptionKey)
        await addRecord(db, REGISTRATION_RECORD, encrypted)
      })
    },
  }
}

export const deviceRegistrationStore = createDeviceRegistrationStore()
