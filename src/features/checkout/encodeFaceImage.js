const MAX_CONTENT_LENGTH = 5000
const JPEG_PREFIX = 'data:image/jpeg;base64,'

export function encodeFaceImage(video, canvas = document.createElement('canvas')) {
  const { videoWidth, videoHeight } = video
  const sourceSize = Math.min(videoWidth, videoHeight)
  if (!sourceSize) throw new Error('Camera frame unavailable')

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Unable to process camera frame')

  const sourceX = (videoWidth - sourceSize) / 2
  const sourceY = (videoHeight - sourceSize) / 2
  for (const size of [320, 256, 224, 192, 160]) {
    canvas.width = canvas.height = size
    context.drawImage(video, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size)
    for (const quality of [.75, .55, .35]) {
      const data = canvas.toDataURL('image/jpeg', quality)
      const content = data.slice(JPEG_PREFIX.length)
      if (data.startsWith(JPEG_PREFIX) && content.length && content.length <= MAX_CONTENT_LENGTH) return content
    }
  }
  throw new Error('Camera frame exceeds the upload limit')
}
