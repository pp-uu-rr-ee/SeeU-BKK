import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { authMiddleware } from '../middleware/auth'
import { PLACE_COLUMNS, getRatingStats, toPublicPlace } from '../lib/place-data'

const favorites = new Hono()

favorites.use('*', authMiddleware)

// GET /api/favorites - List the current user's favorite places, newest first
favorites.get('/', async (c) => {
  const user = c.get('user')

  try {
    const { data: rows, error } = await supabase
      .from('user_favorites')
      .select('place_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const placeIds = (rows || []).map((r) => r.place_id)
    if (placeIds.length === 0) {
      return c.json({ success: true, data: [], placeIds: [] })
    }

    const { data: placeRows, error: placesError } = await supabase
      .from('bangkok_unseen')
      .select(PLACE_COLUMNS)
      .in('id', placeIds)
      .eq('is_published', true)

    if (placesError) throw placesError

    const stats = await getRatingStats(placeIds)
    const byId = new Map(((placeRows || []) as any[]).map((p) => [p.id, p]))
    const data = (rows || [])
      .filter((r) => byId.has(r.place_id))
      .map((r) => ({ ...toPublicPlace(byId.get(r.place_id), stats), favorited_at: r.created_at }))

    return c.json({ success: true, data, placeIds })
  } catch (error) {
    console.error('Error fetching favorites:', error)
    return c.json({
      success: false,
      message: 'Failed to fetch favorites',
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// PUT /api/favorites/:placeId - Add a place to favorites (idempotent)
favorites.put('/:placeId', async (c) => {
  const user = c.get('user')
  const placeId = c.req.param('placeId')

  try {
    const { error } = await supabase
      .from('user_favorites')
      .upsert({ user_id: user.id, place_id: placeId }, { onConflict: 'user_id,place_id', ignoreDuplicates: true })

    if (error) {
      // 23503 = foreign key violation (unknown place), 22P02 = invalid uuid
      if (error.code === '23503' || error.code === '22P02') {
        return c.json({ success: false, message: 'Place not found' }, 404)
      }
      throw error
    }
    return c.json({ success: true, isFavorite: true })
  } catch (error) {
    console.error('Error adding favorite:', error)
    return c.json({
      success: false,
      message: 'Failed to add favorite',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// DELETE /api/favorites/:placeId - Remove a place from favorites
favorites.delete('/:placeId', async (c) => {
  const user = c.get('user')
  const placeId = c.req.param('placeId')

  try {
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('place_id', placeId)

    if (error && error.code !== '22P02') throw error
    return c.json({ success: true, isFavorite: false })
  } catch (error) {
    console.error('Error removing favorite:', error)
    return c.json({
      success: false,
      message: 'Failed to remove favorite',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export default favorites
