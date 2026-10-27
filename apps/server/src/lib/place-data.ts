import { supabase } from './supabase'
import { nameToSlug, slugToName } from './slug-utils'

// Public place columns (excludes the 1536-dim embedding, which is heavy and internal)
export const PLACE_COLUMNS =
  'id, name, slug, area, description, name_th, description_th, tags, lat, lng, address, price, image_url, is_published, phone, website, suggested_duration_min, best_for, created_at, updated_at'

export interface RatingStats {
  avg_rating: number | null
  review_count: number
}

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

export async function getRatingStats(placeIds: string[]): Promise<Map<string, RatingStats>> {
  const stats = new Map<string, RatingStats>()
  if (placeIds.length === 0) return stats

  const { data, error } = await supabase
    .from('place_rating_stats')
    .select('place_id, avg_rating, review_count')
    .in('place_id', placeIds)

  if (error) {
    console.error('Error fetching rating stats:', error)
    return stats
  }
  for (const row of data || []) {
    stats.set(row.place_id, { avg_rating: row.avg_rating, review_count: row.review_count })
  }
  return stats
}

/** Normalize a place row for API responses and attach rating stats */
export function toPublicPlace(place: any, stats?: Map<string, RatingStats>) {
  const rating = stats?.get(place.id)
  return {
    ...place,
    image_url: place.image_url || '',
    tags: Array.isArray(place.tags) ? place.tags : [],
    best_for: Array.isArray(place.best_for) ? place.best_for : [],
    price: typeof place.price === 'number' ? place.price : 0,
    address: place.address || '',
    description: place.description || '',
    slug: place.slug || nameToSlug(place.name || 'unknown-place'),
    avg_rating: rating?.avg_rating ?? null,
    review_count: rating?.review_count ?? 0,
  }
}

/**
 * Find a published place by its slug column, falling back to the legacy
 * name-derived lookup for links generated before slugs were stored.
 */
export async function findPlaceBySlug(slug: string, columns = PLACE_COLUMNS) {
  const bySlug = await supabase
    .from('bangkok_unseen')
    .select(columns)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (bySlug.error) throw bySlug.error
  if (bySlug.data) return bySlug.data as any

  const searchName = slugToName(slug)
  const byName = await supabase
    .from('bangkok_unseen')
    .select(columns)
    .eq('is_published', true)
    .ilike('name', `%${sanitizeSearchTerm(searchName).replace(/\s+/g, '%')}%`)
    .limit(1)
    .maybeSingle()

  if (byName.error) throw byName.error
  return (byName.data as any) || null
}
