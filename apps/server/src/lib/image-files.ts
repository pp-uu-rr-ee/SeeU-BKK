const IMAGE_EXTENSIONS: Record<string, 'jpg' | 'png' | 'webp' | 'gif'> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** File extension for an image Content-Type (parameters like `; charset=...` ignored), or null for anything else */
export function imageExtensionFor(contentType: string | null): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (!contentType) return null
  const type = contentType.split(';')[0].trim().toLowerCase()
  return IMAGE_EXTENSIONS[type] ?? null
}

/** Object path for a place image inside the `place-images` bucket */
export function placeImagePath(slug: string, ext: string): string {
  return `places/${slug}.${ext}`
}

/** Upload limit for admin place photos (same as profile photos) */
export const MAX_PLACE_IMAGE_BYTES = 5 * 1024 * 1024

/** Unique object path for an admin-uploaded place image; a new name per upload avoids stale CDN caches */
export function uploadedPlaceImagePath(ext: string, id: string = crypto.randomUUID()): string {
  return `places/uploads/${id}.${ext}`
}
