const MAX_EDGE = 1024
const JPEG_QUALITY = 0.82

export interface EncodedImage {
  base64: string
  mediaType: 'image/jpeg'
  /** プレビュー用 data URL */
  dataUrl: string
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像を読み込めませんでした'))
    }
    img.src = url
  })
}

/** 写真を長辺 1024px の JPEG に縮小して base64 化する（通信量とトークンを抑える） */
export async function encodeImageForAi(file: File): Promise<EncodedImage> {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像の変換に失敗しました')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return { base64, mediaType: 'image/jpeg', dataUrl }
}
