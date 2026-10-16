const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

// Returns an error message, or '' if the file is fine
export function validateImage(file) {
    if (!ALLOWED.includes(file.type)) return 'Use a JPG, PNG, or WebP image.'
    if (file.size > MAX_SIZE) return 'The image must be 5 MB or smaller.'
    return ''
}

export async function uploadImage(file) {
  const problem = validateImage(file)
  if (problem) throw new Error(problem)

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', UPLOAD_PRESET)

  let res
  try {
    res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body }
    )
  } catch (err) {
    console.error('Cloudinary upload error:', err)
    throw new Error('The photo could not be uploaded. Check your internet connection, then try again.')
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    console.error('Cloudinary rejected the upload:', res.status, detail)
    throw new Error('The photo could not be uploaded. Please try again.')
  }

  const data = await res.json()
  return data.secure_url
}

// Smaller, faster version of an uploaded image (use this when displaying)
export function optimizedUrl(url, width = 600) {
    if (!url) return ''
    return url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`)
}