/**
 * Compute embeddings for places that don't have one yet, so vector search
 * (match_places) can find them.
 *
 * Usage (from apps/server): bun run db:embed            # only places missing an embedding
 *                           bun run db:embed --all      # recompute every place
 */
import 'dotenv/config'
import { supabase } from '../lib/supabase'
import { openaiEmbed } from '../lib/openai'
import { buildPlaceEmbeddingText } from '../lib/place-data'

const recomputeAll = process.argv.includes('--all')

let query = supabase
  .from('bangkok_unseen')
  .select('id, name, area, description, name_th, description_th, tags, address, price')
  .order('name')
if (!recomputeAll) query = query.is('embedding', null)

const { data: places, error } = await query
if (error) {
  console.error('Failed to load places:', error.message)
  process.exit(1)
}

console.log(`${places.length} place(s) to embed${recomputeAll ? ' (recomputing all)' : ''}`)

let failed = 0
for (const place of places) {
  try {
    const embedding = await openaiEmbed(buildPlaceEmbeddingText(place))
    const { error: updateError } = await supabase
      .from('bangkok_unseen')
      .update({ embedding })
      .eq('id', place.id)
    if (updateError) throw updateError
    console.log(`  ✓ ${place.name}`)
  } catch (e: any) {
    failed++
    console.error(`  ✗ ${place.name}: ${e?.message || e}`)
    // Stop early on quota/auth errors instead of failing every row the same way
    if (e?.status === 429 || e?.status === 401) {
      console.error('Stopping: OpenAI rejected the request (check credits / API key).')
      break
    }
  }
}

console.log(failed ? `Done with ${failed} failure(s).` : 'Done.')
process.exit(failed ? 1 : 0)
