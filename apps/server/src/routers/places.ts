import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase'
import { authMiddleware } from '../middleware/auth'
import { haversineKm } from '../lib/tools'
import {
  PLACE_COLUMNS,
  categoriesToTags,
  findPlaceBySlug,
  getRatingStats,
  placeSearchFilter,
  toPublicPlace,
} from '../lib/place-data'

const places = new Hono()

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(''),
})

// GET /places - Get all published places with optional search and pagination
places.get('/', async (c) => {
  try {
    // `query`/`categories` are what the map page sends; `search`/`tag` are kept for older callers
    const { search, query: queryParam, tag, categories, limit = '10', offset = '0' } = c.req.query()
    const searchTerm = search || queryParam
    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 200)
    const offsetNum = Math.max(parseInt(offset) || 0, 0)

    let query = supabase
      .from('bangkok_unseen')
      .select(PLACE_COLUMNS, { count: 'exact' })
      .eq('is_published', true)
      .order('name')
      .range(offsetNum, offsetNum + limitNum - 1)

    const filter = searchTerm ? placeSearchFilter(searchTerm) : null
    if (filter) query = query.or(filter)
    const tags = categoriesToTags([tag, categories].filter(Boolean).join(','))
    if (tags.length) query = query.overlaps('tags', tags)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching places:', error)
      return c.json({
        success: false,
        message: 'Failed to fetch places',
        data: [],
        error: error.message
      }, 500)
    }

    const rows = (data || []) as any[]
    const stats = await getRatingStats(rows.map((p) => p.id))
    const cleanData = rows.map((p) => toPublicPlace(p, stats))

    return c.json({
      success: true,
      data: cleanData,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        count: cleanData.length,
        total: count || 0
      }
    })
  } catch (error) {
    console.error('Server error:', error)
    return c.json({
      success: false,
      message: 'Internal server error',
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /places/:slug - Get a specific place with opening hours and rating
places.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    const place = await findPlaceBySlug(slug)

    if (!place) {
      return c.json({
        success: false,
        message: `Place "${slug}" not found`,
        data: null
      }, 404)
    }

    const [stats, hoursResult] = await Promise.all([
      getRatingStats([place.id]),
      supabase
        .from('place_opening_hours')
        .select('day_of_week, open_time, close_time, is_closed, note')
        .eq('place_id', place.id)
        .order('day_of_week'),
    ])

    if (hoursResult.error) console.error('Error fetching opening hours:', hoursResult.error)

    return c.json({
      success: true,
      data: {
        ...toPublicPlace(place, stats),
        opening_hours: hoursResult.data || [],
      }
    })
  } catch (error) {
    console.error('Server error:', error)
    return c.json({
      success: false,
      message: 'Internal server error',
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /places/:slug/nearby - Get nearby places (within ~5km), closest first
places.get('/:slug/nearby', async (c) => {
  try {
    const slug = c.req.param('slug')
    const limit = Math.min(parseInt(c.req.query('limit') || '5') || 5, 20)

    const currentPlace = await findPlaceBySlug(slug, 'id, lat, lng, name')
    if (!currentPlace) {
      return c.json({
        success: false,
        message: 'Place not found',
        data: []
      }, 404)
    }

    const range = 0.045 // Approximately 5km
    const { data, error } = await supabase
      .from('bangkok_unseen')
      .select(PLACE_COLUMNS)
      .eq('is_published', true)
      .neq('id', currentPlace.id)
      .gte('lat', currentPlace.lat - range)
      .lte('lat', currentPlace.lat + range)
      .gte('lng', currentPlace.lng - range)
      .lte('lng', currentPlace.lng + range)
      .limit(100)

    if (error) {
      console.error('Error fetching nearby places:', error)
      return c.json({
        success: false,
        message: 'Failed to fetch nearby places',
        data: [],
        error: error.message
      }, 500)
    }

    const origin = { lat: currentPlace.lat, lng: currentPlace.lng }
    const nearest = ((data || []) as any[])
      .map((p) => ({ ...p, distance_km: haversineKm(origin, { lat: p.lat, lng: p.lng }) }))
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit)

    const stats = await getRatingStats(nearest.map((p) => p.id))

    return c.json({
      success: true,
      data: nearest.map((p) => toPublicPlace(p, stats))
    })
  } catch (error) {
    console.error('Server error:', error)
    return c.json({
      success: false,
      message: 'Internal server error',
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /places/:slug/reviews - Public list of reviews, newest first
places.get('/:slug/reviews', async (c) => {
  try {
    const slug = c.req.param('slug')
    const limit = Math.min(parseInt(c.req.query('limit') || '20') || 20, 100)

    const place = await findPlaceBySlug(slug, 'id')
    if (!place) {
      return c.json({ success: false, message: 'Place not found', data: [] }, 404)
    }

    const { data: reviews, error } = await supabase
      .from('place_reviews')
      .select('id, user_id, rating, comment, created_at, updated_at')
      .eq('place_id', place.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    // Attach reviewer display info from user_profiles
    const userIds = [...new Set((reviews || []).map((r) => r.user_id))]
    const { data: profiles } = userIds.length
      ? await supabase.from('user_profiles').select('user_id, nick_name, avatar_url').in('user_id', userIds)
      : { data: [] as any[] }
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]))

    const stats = await getRatingStats([place.id])
    const rating = stats.get(place.id)

    return c.json({
      success: true,
      data: (reviews || []).map((r) => ({
        ...r,
        author: {
          nick_name: profileMap.get(r.user_id)?.nick_name || null,
          avatar_url: profileMap.get(r.user_id)?.avatar_url || null,
        },
      })),
      summary: {
        avg_rating: rating?.avg_rating ?? null,
        review_count: rating?.review_count ?? 0,
      },
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return c.json({
      success: false,
      message: 'Failed to fetch reviews',
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// PUT /places/:slug/reviews - Create or update the current user's review
places.put('/:slug/reviews', authMiddleware, zValidator('json', reviewSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  try {
    const place = await findPlaceBySlug(c.req.param('slug'), 'id')
    if (!place) {
      return c.json({ success: false, message: 'Place not found' }, 404)
    }

    const { data, error } = await supabase
      .from('place_reviews')
      .upsert(
        { place_id: place.id, user_id: user.id, rating: body.rating, comment: body.comment || null },
        { onConflict: 'place_id,user_id' }
      )
      .select('id, user_id, rating, comment, created_at, updated_at')
      .single()

    if (error) throw error
    return c.json({ success: true, data })
  } catch (error) {
    console.error('Error saving review:', error)
    return c.json({
      success: false,
      message: 'Failed to save review',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// DELETE /places/:slug/reviews - Delete the current user's review
places.delete('/:slug/reviews', authMiddleware, async (c) => {
  const user = c.get('user')

  try {
    const place = await findPlaceBySlug(c.req.param('slug'), 'id')
    if (!place) {
      return c.json({ success: false, message: 'Place not found' }, 404)
    }

    const { error } = await supabase
      .from('place_reviews')
      .delete()
      .eq('place_id', place.id)
      .eq('user_id', user.id)

    if (error) throw error
    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting review:', error)
    return c.json({
      success: false,
      message: 'Failed to delete review',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export default places
