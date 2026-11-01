/**
 * Re-host place images that are hotlinked from third-party sites in the
 * `place-images` Supabase Storage bucket, then point image_url at the copy.
 *
 * Confirm you have the right to re-host each image before running for real.
 *
 * Usage (from apps/server): bun run db:images --dry-run         # fetch and report, change nothing
 *                           bun run db:images --only wat-pho    # migrate one place
 *                           bun run db:images                   # migrate every hotlinked place
 */
import 'dotenv/config'
import { supabase } from '../lib/supabase'
import { imageExtensionFor, placeImagePath } from '../lib/image-files'

const BUCKET = 'place-images'
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const dryRun = process.argv.includes('--dry-run')
const onlyIndex = process.argv.indexOf('--only')
const onlySlug = onlyIndex !== -1 ? process.argv[onlyIndex + 1] : undefined
if (onlyIndex !== -1 && !onlySlug) {
  console.error('--only needs a slug, e.g. --only wat-pho')
  process.exit(1)
}

let query = supabase.from('bangkok_unseen').select('id, slug, image_url').order('slug')
if (onlySlug) query = query.eq('slug', onlySlug)

const { data: rows, error } = await query
if (error) {
  console.error('Failed to load places:', error.message)
  process.exit(1)
}

const places = rows.filter((p) => p.image_url && !p.image_url.includes('.supabase.co/storage/'))
console.log(`${places.length} hotlinked image(s)${dryRun ? ' — dry run, nothing will be uploaded or updated' : ''}`)

let migrated = 0
const skipped: string[] = []
for (const place of places) {
  const label = place.slug || place.id
  try {
    const res = await fetch(place.image_url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ext = imageExtensionFor(res.headers.get('content-type'))
    if (!ext) throw new Error(`not an image (${res.headers.get('content-type') || 'no content-type'})`)

    const path = placeImagePath(label, ext)
    if (dryRun) {
      console.log(`✓ ${label}: ${place.image_url} → ${BUCKET}/${path}`)
      migrated++
      continue
    }

    const body = await res.arrayBuffer()
    const upload = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: true,
    })
    if (upload.error) throw new Error(`upload: ${upload.error.message}`)

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    const update = await supabase.from('bangkok_unseen').update({ image_url: publicUrl }).eq('id', place.id)
    if (update.error) throw new Error(`update: ${update.error.message}`)

    console.log(`✓ ${label}: ${publicUrl}`)
    migrated++
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error(`✗ ${label}: ${reason} (${place.image_url})`)
    skipped.push(label)
  }
}

console.log(`\n${dryRun ? 'Would migrate' : 'Migrated'}: ${migrated} / skipped: ${skipped.length}`)
if (skipped.length) console.log(`Skipped (left unchanged): ${skipped.join(', ')}`)
