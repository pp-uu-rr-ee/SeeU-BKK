import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase'
import { openaiEmbed } from '../lib/openai'
import { nameToSlug } from '../lib/slug-utils'
import { buildPlaceEmbeddingText } from '../lib/place-data'
import { authMiddleware, roleGuard } from '../middleware/auth'

const admin = new Hono()

// Require authentication + admin role for all routes under /admin
admin.use('*', authMiddleware)
admin.use('*', roleGuard('admin'))


const openingHoursSchema = z.array(z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  is_closed: z.boolean().optional().default(false),
  note: z.string().optional(),
}).refine((h) => h.is_closed || (h.open_time && h.close_time), {
  message: 'open_time and close_time are required unless is_closed',
})).max(7)

const placeDetailFields = {
  phone: z.string().max(50).nullable().optional(),
  website: z.string().url().nullable().optional().or(z.literal('')),
  suggested_duration_min: z.number().int().positive().nullable().optional(),
  best_for: z.array(z.string()).optional(),
  opening_hours: openingHoursSchema.optional(),
}

// Replace a place's weekly opening hours with the given rows
async function saveOpeningHours(placeId: string, hours: z.infer<typeof openingHoursSchema>) {
  const { error: deleteError } = await supabase.from('place_opening_hours').delete().eq('place_id', placeId)
  if (deleteError) throw deleteError
  if (hours.length === 0) return
  const { error } = await supabase.from('place_opening_hours').insert(
    hours.map((h) => ({
      place_id: placeId,
      day_of_week: h.day_of_week,
      open_time: h.is_closed ? null : h.open_time,
      close_time: h.is_closed ? null : h.close_time,
      is_closed: h.is_closed,
      note: h.note || null,
    }))
  )
  if (error) throw error
}

export const placeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1).optional(),                 // server จะ auto-gen ได้
  area: z.string().optional(),
  description: z.string().optional().default(""),
  name_th: z.string().optional(),
  description_th: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  lat: z.number({
    error: "Latitude is required and must be a number",
  }).min(-90).max(90),
  lng: z.number({
    error: "Longitude is required and must be a number",
  }).min(-180).max(180),
  address: z.string().optional().default(""),
  price: z.number().int().nonnegative().nullable().optional(),
  image_url: z.string().url().optional(),
  is_published: z.boolean().optional().default(true),
  embedding: z.array(z.number()).length(1536).optional(),
  compute_embedding: z.boolean().optional().default(false),
  ...placeDetailFields,
})

const updatePlaceSchema = z.object({
  name: z.string().min(1).optional(),
  area: z.string().optional(),
  description: z.string().optional(),
  name_th: z.string().optional(),
  description_th: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.string().optional(),
  price: z.number().optional(),
  image_url: z.string().optional(),
  is_published: z.boolean().optional(),
  embedding: z.array(z.number()).optional(),
  compute_embedding: z.boolean().optional().default(false),
  ...placeDetailFields,
})

// Compute embedding for given text (name + description recommended)
admin.post('/embedding', zValidator('json', z.object({ text: z.string().min(1) })), async (c) => {
  const { text } = c.req.valid('json')
  try {
    const embedding = await openaiEmbed(text)
    return c.json({ success: true, embedding })
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Embedding failed' }, 500)
  }
})

// GET /admin/places - List all places for admin with pagination
admin.get('/places', async (c) => {
  try {
    const { search, limit = '20', offset = '0' } = c.req.query()

    let query = supabase
      .from('bangkok_unseen')
      .select('*')
      // Order by name to avoid missing timestamp columns
      .order('name', { ascending: true })

    // Add search functionality if search parameter is provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Pagination
    const limitNum = parseInt(limit)
    const offsetNum = parseInt(offset)
    query = query.range(offsetNum, offsetNum + limitNum - 1)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching places:', error)
      return c.json({
        success: false,
        message: 'Failed to fetch places',
        data: [],
        error: error.message
      }, 500)
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('bangkok_unseen')
      .select('*', { count: 'exact', head: true })

    // Clean the data and add slugs
    const cleanData = (data || []).map(place => ({
      ...place,
      image_url: place.image_url || '',
      tags: Array.isArray(place.tags) ? place.tags : [],
      price: typeof place.price === 'number' ? place.price : 0,
      slug: nameToSlug(place.name || 'unknown-place')
    }))

    return c.json({
      success: true,
      data: cleanData,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        count: cleanData.length,
        total: totalCount || 0
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

// GET /admin/places/:id - Get single place by ID for editing
admin.get('/places/:id', async (c) => {
  try {
    const id = c.req.param('id')

    if (!id) {
      return c.json({
        success: false,
        message: 'Place ID is required',
        data: null
      }, 400)
    }

    const { data, error } = await supabase
      .from('bangkok_unseen')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching place:', error)
      return c.json({
        success: false,
        message: error.code === 'PGRST116' ? 'Place not found' : 'Failed to fetch place',
        data: null,
        error: error.message
      }, error.code === 'PGRST116' ? 404 : 500)
    }

    const { data: openingHours } = await supabase
      .from('place_opening_hours')
      .select('day_of_week, open_time, close_time, is_closed, note')
      .eq('place_id', id)
      .order('day_of_week')

    // Clean the data and add slug
    const { embedding: _embedding, ...rest } = data
    const cleanData = {
      ...rest,
      has_embedding: Array.isArray(_embedding) ? _embedding.length > 0 : !!_embedding,
      image_url: data.image_url || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      best_for: Array.isArray(data.best_for) ? data.best_for : [],
      price: typeof data.price === 'number' ? data.price : 0,
      address: data.address || '',
      description: data.description || '',
      slug: data.slug || nameToSlug(data.name),
      opening_hours: openingHours || [],
    }

    return c.json({
      success: true,
      data: cleanData
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

// POST /admin/places - Insert a place into bangkok_unseen; optionally compute embedding
admin.post('/places', zValidator('json', placeSchema), async (c) => {
  const body = c.req.valid('json')
  try {
    let embedding = body.embedding
    let embeddingError = null
    if ((!embedding || embedding.length === 0) && body.compute_embedding) {
      const text = buildPlaceEmbeddingText(body)

      try {
        embedding = await openaiEmbed(text)
      } catch (embErr: any) {
        console.error('Embedding computation failed:', embErr)
        embeddingError = embErr?.message || 'Embedding failed'
        embedding = undefined
      }
    }

    const slug = (body.slug && body.slug.length > 0)
      ? body.slug
      : nameToSlug(body.name)

    const payload: any = {
      name: body.name,
      slug,
      area: body.area || null,
      description: body.description || null,
      name_th: body.name_th || null,
      description_th: body.description_th || null,
      tags: body.tags || [],
      lat: body.lat,          // ต้องมีค่าเลขที่ valid
      lng: body.lng,          // ต้องมีค่าเลขที่ valid
      address: body.address || null,
      price: typeof body.price === 'number' ? body.price : null,
      image_url: body.image_url || null,
      is_published: body.is_published ?? false,
      embedding: embedding ?? null,
      phone: body.phone || null,
      website: body.website || null,
      suggested_duration_min: body.suggested_duration_min ?? null,
      best_for: body.best_for || [],
    }

    const { data, error } = await supabase
      .from('bangkok_unseen')
      .insert([payload])     // <<== ต้องเป็น array
      .select()
      .single()

    if (error) throw error
    if (body.opening_hours) await saveOpeningHours(data.id, body.opening_hours)
    
    const responseBody: any = { success: true, data }
    if (embeddingError) responseBody.warning = embeddingError
    return c.json(responseBody)
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Insert failed' }, 400)
  }
})


// PUT /admin/places/:id - Update a place
admin.put('/places/:id', zValidator('json', updatePlaceSchema), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')

  try {
    if (!id) {
      return c.json({
        success: false,
        message: 'Place ID is required'
      }, 400)
    }

    // Check if place exists
    const { data: existingPlace, error: fetchError } = await supabase
      .from('bangkok_unseen')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      return c.json({
        success: false,
        message: fetchError.code === 'PGRST116' ? 'Place not found' : 'Failed to fetch place',
        error: fetchError.message
      }, fetchError.code === 'PGRST116' ? 404 : 500)
    }

    // Prepare update payload
    const updatePayload: any = {}

    if (body.name !== undefined) updatePayload.name = body.name
    if (body.area !== undefined) updatePayload.area = body.area
    if (body.description !== undefined) updatePayload.description = body.description
    if (body.name_th !== undefined) updatePayload.name_th = body.name_th
    if (body.description_th !== undefined) updatePayload.description_th = body.description_th
    if (body.tags !== undefined) updatePayload.tags = body.tags
    if (body.lat !== undefined) updatePayload.lat = body.lat
    if (body.lng !== undefined) updatePayload.lng = body.lng
    if (body.address !== undefined) updatePayload.address = body.address
    if (body.price !== undefined) updatePayload.price = body.price
    if (body.image_url !== undefined) updatePayload.image_url = body.image_url
    if (body.is_published !== undefined) updatePayload.is_published = body.is_published
    if (body.phone !== undefined) updatePayload.phone = body.phone || null
    if (body.website !== undefined) updatePayload.website = body.website || null
    if (body.suggested_duration_min !== undefined) updatePayload.suggested_duration_min = body.suggested_duration_min
    if (body.best_for !== undefined) updatePayload.best_for = body.best_for

    // Handle embedding
    let embedding = body.embedding
    let embeddingError = null
    if ((!embedding || embedding.length === 0) && body.compute_embedding) {
      const text = buildPlaceEmbeddingText({ ...existingPlace, ...body, name: body.name || existingPlace.name })

      try {
        embedding = await openaiEmbed(text)
      } catch (embErr: any) {
        console.error('Embedding computation failed:', embErr)
        embeddingError = embErr?.message || 'Embedding failed'
        embedding = undefined
      }
    }
    if (embedding && Array.isArray(embedding) && embedding.length) {
      updatePayload.embedding = embedding
    }

    const { data, error } = await supabase
      .from('bangkok_unseen')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (body.opening_hours) await saveOpeningHours(id, body.opening_hours)
    
    const responseBody: any = { success: true, data }
    if (embeddingError) responseBody.warning = embeddingError
    return c.json(responseBody)
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Update failed' }, 500)
  }
})

// DELETE /admin/places/:id - Delete a place
admin.delete('/places/:id', async (c) => {
  try {
    const id = c.req.param('id')

    if (!id) {
      return c.json({
        success: false,
        message: 'Place ID is required'
      }, 400)
    }

    // Check if place exists first
    const { data: existingPlace, error: fetchError } = await supabase
      .from('bangkok_unseen')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError) {
      return c.json({
        success: false,
        message: fetchError.code === 'PGRST116' ? 'Place not found' : 'Failed to fetch place',
        error: fetchError.message
      }, fetchError.code === 'PGRST116' ? 404 : 500)
    }

    const { error } = await supabase
      .from('bangkok_unseen')
      .delete()
      .eq('id', id)

    if (error) throw error

    return c.json({
      success: true,
      message: `Place "${existingPlace.name}" has been deleted successfully`
    })
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Delete failed' }, 500)
  }
})

export default admin
