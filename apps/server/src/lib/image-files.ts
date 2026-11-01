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
