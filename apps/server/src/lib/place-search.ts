/**
 * Make a user search term safe to embed in a PostgREST `.or()` filter.
 * Commas, parentheses and quotes would otherwise break or alter the filter.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_,()\\*"':]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Build an `.or()` filter matching English and Thai name/description */
export function placeSearchFilter(term: string): string | null {
  const kw = sanitizeSearchTerm(term)
  if (!kw) return null
  return ['name', 'description', 'name_th', 'description_th']
    .map((col) => `${col}.ilike.%${kw}%`)
    .join(',')
}

/** Text representation used for place embeddings (admin create/update and the backfill script) */
export function buildPlaceEmbeddingText(place: {
  name: string
  area?: string | null
  description?: string | null
  name_th?: string | null
  description_th?: string | null
  tags?: string[] | null
  address?: string | null
  price?: number | null
}): string {
  return [
    `Name: ${place.name}`,
    place.name_th ? `Thai name: ${place.name_th}` : null,
    `Area: ${place.area || 'Unknown'}`,
    `Description: ${place.description || ''}`,
    place.description_th ? `Thai description: ${place.description_th}` : null,
    `Tags: ${Array.isArray(place.tags) ? place.tags.join(', ') : ''}`,
    `Address: ${place.address || ''}`,
    `Price: ${place.price ? place.price + ' Baht' : 'Free'}`,
  ].filter(Boolean).join('\n')
}

// UI category ids that don't exist as tags map onto the tags actually stored in bangkok_unseen
const CATEGORY_TAG_ALIASES: Record<string, string[]> = {
  restaurant: ['food', 'restaurant'],
  shopping: ['market', 'mall', 'walking-street', 'shopping'],
  cafe: ['cafe', 'coffee'],
  attraction: ['landmark', 'architecture', 'history', 'attraction'],
}

/** Expand UI categories (comma-separated or array) into the tags to match with ANY semantics */
export function categoriesToTags(categories: string | string[] | undefined): string[] {
  const list = Array.isArray(categories) ? categories : (categories || '').split(',')
  const tags = list
    .map((c) => sanitizeSearchTerm(c).toLowerCase())
    .filter((c) => c && c !== 'all')
    .flatMap((c) => CATEGORY_TAG_ALIASES[c] || [c])
  return [...new Set(tags)]
}
