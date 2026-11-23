import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeFaceImage, encodeFaceImageFile } from '../../../src/features/checkout/encodeFaceImage.js'

test('crops the visible square and returns a JPEG payload within the API limit', () => {
  const draws = []
  const video = { videoWidth: 640, videoHeight: 480 }
  const canvas = {
    getContext: () => ({ drawImage: (...args) => draws.push(args) }),
    toDataURL(type) { return `data:${type};base64,${'A'.repeat(this.width === 320 ? 5004 : 5000)}` },
  }
  assert.equal(encodeFaceImage(video, canvas), 'A'.repeat(5000))
  assert.deepEqual(draws, [
    [video, 80, 0, 480, 480, 0, 0, 320, 320],
    [video, 80, 0, 480, 480, 0, 0, 256, 256],
  ])
})

test('rejects frames that are unavailable or cannot be encoded within the limit', () => {
  assert.throws(() => encodeFaceImage({ videoWidth: 0, videoHeight: 0 }, {}), /unavailable/)
  const canvas = {
    getContext: () => ({ drawImage() {} }),
    toDataURL: () => 'data:image/png;base64,AAAA',
  }
  assert.throws(() => encodeFaceImage({ videoWidth: 640, videoHeight: 480 }, canvas), /upload limit/)
})

test('decodes JPEG and PNG files and encodes the centered square as a JPEG payload', async (t) => {
  for (const type of ['image/jpeg', 'image/png']) {
    const file = new File(['image bytes'], 'face', { type })
    const bitmap = { width: 300, height: 500, close: t.mock.fn() }
    const decode = t.mock.fn(async () => bitmap)
    const drawImage = t.mock.fn()
    const canvas = {
      getContext: () => ({ drawImage }),
      toDataURL: (format) => `data:${format};base64,AA==`,
    }

    assert.equal(await encodeFaceImageFile(file, decode, canvas), 'AA==')
    assert.deepEqual(decode.mock.calls[0].arguments, [file])
    assert.deepEqual(drawImage.mock.calls[0].arguments, [bitmap, 0, 100, 300, 300, 0, 0, 320, 320])
    assert.equal(bitmap.close.mock.callCount(), 1)
  }
})

test('rejects empty or unsupported files before decoding', async (t) => {
  const decode = t.mock.fn()
  await assert.rejects(encodeFaceImageFile(new File([], 'empty.jpg', { type: 'image/jpeg' }), decode), /JPEG or PNG/)
  await assert.rejects(encodeFaceImageFile(new File(['text'], 'face.txt', { type: 'text/plain' }), decode), /JPEG or PNG/)
  assert.equal(decode.mock.callCount(), 0)
})

test('rejects unreadable files and releases decoded images when encoding fails', async (t) => {
  const file = new File(['image bytes'], 'face.jpg', { type: 'image/jpeg' })
  const decodeError = new Error('Invalid image data')
  await assert.rejects(encodeFaceImageFile(file, async () => { throw decodeError }), decodeError)

  const bitmap = { width: 300, height: 500, close: t.mock.fn() }
  await assert.rejects(
    encodeFaceImageFile(file, async () => bitmap, { getContext: () => null }),
    /Unable to process face image/,
  )
  assert.equal(bitmap.close.mock.callCount(), 1)
})
