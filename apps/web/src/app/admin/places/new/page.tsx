"use client"

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AdminMapPicker } from '@/components/map/admin-map-picker'
import { MapPin, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/contexts/language-context'
import {
  PlaceDetailsFields,
  emptyPlaceDetails,
  placeDetailsToPayload,
  type PlaceDetailsValue,
} from '@/components/admin/place-details-fields'

type PlacePayload = {
  name: string
  slug?: string
  area?: string
  description?: string
  name_th?: string
  description_th?: string
  tags?: string[]
  lat: number
  lng: number
  address?: string
  price?: number | null
  image_url?: string
  is_published?: boolean
  embedding?: number[]
  compute_embedding?: boolean
} & Partial<ReturnType<typeof placeDetailsToPayload>>

function slugify(s: string) {
  return s
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')      // remove diacritics
    .replace(/[^\u0E00-\u0E7F\w\s-]/g, '') // keep Thai, alphanumeric, space, dash, underscore
    .replace(/\s+/g, ' ')               // collapse spaces
    .trim()
    .replace(/\s/g, '-')                // space -> dash
}

export default function AdminNewPlacePage() {
  const [form, setForm] = useState<Partial<PlacePayload>>({ name: '', is_published: true })
  const [tagsText, setTagsText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [details, setDetails] = useState<PlaceDetailsValue>(emptyPlaceDetails())
  const { t } = useTranslation()

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

  const update = (k: keyof PlacePayload, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const handleLocationSelect = (lat: number, lng: number) => {
    setForm((f) => ({ ...f, lat, lng }))
  }

  // auto-generate slug from name
  const autoSlug = useMemo(() => slugify(form.name || ''), [form.name])
  const effectiveSlug = slugTouched ? (form.slug || '') : autoSlug

  const latNum = form.lat != null ? Number(form.lat) : NaN
  const lngNum = form.lng != null ? Number(form.lng) : NaN
  const priceNum = form.price != null && String(form.price) !== '' ? Number(form.price) : null

  const latValid = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90
  const lngValid = Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180
  const priceValid = priceNum === null || (Number.isInteger(priceNum) && priceNum >= 0)

  const canSubmit =
    !!form.name &&
    latValid &&
    lngValid &&
    priceValid &&
    !busy

  const handleSubmit = async () => {
    setError(null)
    setBusy(true)
    setResult(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const payload: PlacePayload = {
        name: (form.name || '').trim(),
        slug: (effectiveSlug || undefined),
        area: (form.area || undefined)?.trim() || undefined,
        description: (form.description || undefined)?.trim() || undefined,
        name_th: (form.name_th || undefined)?.trim() || undefined,
        description_th: (form.description_th || undefined)?.trim() || undefined,
        tags: tagsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        lat: Number(latNum),
        lng: Number(lngNum),
        address: (form.address || '').trim() || 'Bangkok, Thailand',
        price: priceNum === null ? null : Number(priceNum),
        image_url: (form.image_url || undefined)?.trim() || undefined,
        compute_embedding: true,
        ...placeDetailsToPayload(details),
      }

      const res = await fetch(`${serverUrl}/api/admin/places`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(payload),
      })
      
      const contentType = res.headers.get('content-type') || ''
      const j = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || t('admin.unexpectedResponse') }
        
      if (!res.ok || !j.success) throw new Error(j.error || t('admin.insertFailed'))
      
      if (j.warning) alert(t('admin.warning', { message: j.warning }))
      setResult(j)
      // reset form
      setForm({ name: '', is_published: true })
      setTagsText('')
      setSlugTouched(false)
      setDetails(emptyPlaceDetails())
    } catch (e: any) {
      setError(e?.message || t('admin.insertFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <Link href="/admin/places" className="mb-6 inline-flex items-center gap-2 rounded-full py-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('admin.backToPlaces')}
      </Link>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">{t('admin.newTitle')}</h1>
      <p className="mt-2 text-muted-foreground">{t('admin.newSubtitle')}</p>
      <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">

      <div className="grid gap-4">
        {/* Name & Slug */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block">{t('admin.fieldName')} *</Label>
            <Input
              value={form.name || ''}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Wat Pho"
              className="h-11 rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">{t('admin.fieldSlug')}</Label>
            <Input
              value={slugTouched ? (form.slug || '') : autoSlug}
              onChange={(e) => {
                setSlugTouched(true)
                update('slug', e.target.value)
              }}
              placeholder="wat-pho"
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('admin.slugHint')}</p>
          </div>
        </div>

        {/* Area */}
        <div>
          <Label className="mb-1.5 block">{t('admin.fieldArea')}</Label>
          <Input
            value={form.area || ''}
            onChange={(e) => update('area', e.target.value)}
            placeholder="Talat Noi / Ari / ... "
            className="h-11 rounded-xl"
          />
        </div>

        {/* Description */}
        <div>
          <Label className="mb-1.5 block">{t('admin.fieldDescriptionEn')}</Label>
          <Textarea
            value={form.description || ''}
            onChange={(e) => update('description', e.target.value)}
            rows={5}
            placeholder={t('admin.descriptionPlaceholder')}
            className="text-black border-border dark:border-border"
          />
        </div>

        {/* Thai translations */}
        <div>
          <Label className="mb-1.5 block">{t('admin.fieldNameTh')}</Label>
          <Input
            value={form.name_th || ''}
            onChange={(e) => update('name_th', e.target.value)}
            placeholder="วัดโพธิ์"
            className="h-11 rounded-xl"
          />
        </div>
        <div>
          <Label className="mb-1.5 block">{t('admin.fieldDescriptionTh')}</Label>
          <Textarea
            value={form.description_th || ''}
            onChange={(e) => update('description_th', e.target.value)}
            rows={5}
            placeholder={t('admin.descriptionThPlaceholder')}
            className="text-black border-border dark:border-border"
          />
        </div>

        {/* Lat/Lng with Map Picker */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="font-semibold">{t('admin.fieldCoordinates')} *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMap(!showMap)}
              className="text-primary border-primary hover:bg-teal-soft"
            >
              <MapPin className="h-4 w-4 mr-2" />
              {showMap ? t('admin.hideMap') : t('admin.showMap')}
            </Button>
          </div>

          {/* Map Picker */}
          {showMap && (
            <div className="mb-4">
              <AdminMapPicker
                lat={form.lat}
                lng={form.lng}
                onLocationSelect={handleLocationSelect}
                className="h-[500px]"
              />
            </div>
          )}

          {/* Manual Input Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">{t('admin.fieldLat')} *</Label>
              <Input
                type="number"
                step="any"
                value={form.lat ?? ''}
                onChange={(e) => update('lat', e.target.value)}
                placeholder="13.746"
                className="h-11 rounded-xl"
              />
              {!latValid && <p className="text-xs text-destructive mt-1">{t('admin.latRange')}</p>}
            </div>
            <div>
              <Label className="mb-1.5 block">{t('admin.fieldLng')} *</Label>
              <Input
                type="number"
                step="any"
                value={form.lng ?? ''}
                onChange={(e) => update('lng', e.target.value)}
                placeholder="100.535"
                className="h-11 rounded-xl"
              />
              {!lngValid && <p className="text-xs text-destructive mt-1">{t('admin.lngRange')}</p>}
            </div>
          </div>
          
          {form.lat && form.lng && latValid && lngValid && (
            <p className="text-xs text-primary mt-2 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {t('admin.locationSet', { lat: Number(form.lat).toFixed(6), lng: Number(form.lng).toFixed(6) })}
            </p>
          )}
        </div>

        {/* Address */}
        {/* <div>
          <Label className="mb-1.5 block">{t('admin.fieldAddress')}</Label>
          <Input
            value={form.address || ''}
            onChange={(e) => update('address', e.target.value)}
            placeholder="Bangkok, Thailand"
            className="h-11 rounded-xl"
          />
        </div> */}

        {/* Price & Image */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block">{t('admin.fieldPrice')}</Label>
            <Input
              type="number"
              step="1"
              min="0"
              value={form.price ?? ''}
              onChange={(e) => update('price', e.target.value)}
              placeholder="200"
              className="h-11 rounded-xl"
            />
            {!priceValid && <p className="text-xs text-destructive mt-1">{t('admin.priceInvalid')}</p>}
          </div>
          <div>
            <Label className="mb-1.5 block">{t('admin.fieldImageUrl')}</Label>
            <Input
              value={form.image_url || ''}
              onChange={(e) => update('image_url', e.target.value)}
              placeholder="https://..."
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <Label className="mb-1.5 block">{t('admin.fieldTags')}</Label>
          <Input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="temple, history, culture"
            className="h-11 rounded-xl"
          />
        </div>
        
        {/* Visit details & opening hours */}
        <div className="pt-4 border-t border-border">
          <h2 className="text-lg font-semibold mb-3">{t('admin.visitDetails')}</h2>
          <PlaceDetailsFields value={details} onChange={setDetails} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 items-center">
          <Button onClick={handleSubmit} disabled={!canSubmit} className='h-12 rounded-full px-7 text-base'>
            {t('admin.addPlace')}
          </Button>
          {busy && <div className="text-sm text-muted-foreground">{t('admin.working')}</div>}
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {result && (
          <pre className="text-xs bg-muted p-3 rounded-md border overflow-auto max-h-64 text-foreground">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
      </div>
    </div>
  )
}
