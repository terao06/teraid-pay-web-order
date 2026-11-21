import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeFaceImage } from '../../../src/features/checkout/encodeFaceImage.js'

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
