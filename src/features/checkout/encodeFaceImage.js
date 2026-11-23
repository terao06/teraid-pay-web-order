const MAX_CONTENT_LENGTH = 5000
const JPEG_PREFIX = 'data:image/jpeg;base64,'

export const FACE_IMAGE_FILE_TYPES = ['image/jpeg', 'image/png']

export function encodeFaceImage(source, canvas = document.createElement('canvas')) {
  const width = source.videoWidth ?? source.width
  const height = source.videoHeight ?? source.height
  const sourceSize = Math.min(width, height)
  if (!sourceSize) throw new Error('Face image unavailable')

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Unable to process face image')

  const sourceX = (width - sourceSize) / 2
  const sourceY = (height - sourceSize) / 2
  for (const size of [320, 256, 224, 192, 160]) {
    canvas.width = canvas.height = size
    context.drawImage(source, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size)
    for (const quality of [.75, .55, .35]) {
      const data = canvas.toDataURL('image/jpeg', quality)
      const content = data.slice(JPEG_PREFIX.length)
      if (data.startsWith(JPEG_PREFIX) && content.length && content.length <= MAX_CONTENT_LENGTH) return content
    }
  }
  throw new Error('Face image exceeds the upload limit')
}

export async function encodeFaceImageFile(file, decode = createImageBitmap, canvas) {
  if (!file.size || !FACE_IMAGE_FILE_TYPES.includes(file.type)) {
    throw new Error('Expected a JPEG or PNG face image')
  }

  const bitmap = await decode(file)
  try {
    return encodeFaceImage(bitmap, canvas)
  } finally {
    bitmap.close()
  }
}
