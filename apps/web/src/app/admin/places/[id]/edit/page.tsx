"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/contexts/language-context'
import {
  PlaceDetailsFields,
  emptyPlaceDetails,
  placeDetailsFromApi,
  placeDetailsToPayload,
  type PlaceDetailsValue,
} from '@/components/admin/place-details-fields'

type PlacePayload = {
  name?: string
  description?: string
  name_th?: string
  description_th?: string
  tags?: string[]
  lat?: number
  lng?: number
  address?: string
  price?: number
  image_url?: string
  embedding?: number[]
  compute_embedding?: boolean
} & Partial<ReturnType<typeof placeDetailsToPayload>>

interface Place {
  id: string
  name: string
  description: string
  name_th?: string
  description_th?: string
  tags: string[]
  lat: number
  lng: number
  address: string
  price: number
  image_url: string
}

export default function AdminEditPlacePage() {
  const params = useParams()
  const router = useRouter()
  const placeId = params?.id as string
  const { t } = useTranslation()
  
  const [form, setForm] = useState<PlacePayload>({})
  const [tagsText, setTagsText] = useState('')
  const [embedding, setEmbedding] = useState<number[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [originalPlace, setOriginalPlace] = useState<Place | null>(null)
  const [details, setDetails] = useState<PlaceDetailsValue>(emptyPlaceDetails())
  const [originalDetails, setOriginalDetails] = useState<PlaceDetailsValue>(emptyPlaceDetails())

  const update = (k: keyof PlacePayload, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const getAuthHeaders = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    return {
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
    }
  }

  const fetchPlace = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/places/${placeId}`, {
        headers: {
          ...(await getAuthHeaders()),
        },
      })
      
      const contentType = res.headers.get('content-type') || ''
      const data = contentType.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || t('admin.unexpectedResponse') }
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('admin.loadPlaceFailed'))
      }
      
      const place = data.data
      setOriginalPlace(place)
      setForm({
        name: place.name,
        description: place.description,
        name_th: place.name_th || '',
        description_th: place.description_th || '',
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        price: place.price,
        image_url: place.image_url
      })
      setTagsText(Array.isArray(place.tags) ? place.tags.join(', ') : '')
      const loadedDetails = placeDetailsFromApi(place)
      setDetails(loadedDetails)
      setOriginalDetails(loadedDetails)
    } catch (e: any) {
      setError(e?.message || t('admin.loadPlaceFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateEmbedding = async () => {
    setError(null)
    setBusy(true)
    setResult(null)
    try {
      const text = `${form.name || ''}\n\n${form.description || ''}`.trim()
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/embedding`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ text }),
      })
      const contentType = res.headers.get('content-type') || ''
      const j = contentType.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || t('admin.unexpectedResponse') }
      if (!res.ok || !j.success) throw new Error(j.error || t('admin.embeddingFailed'))
      setEmbedding(j.embedding)
    } catch (e: any) {
      setError(e?.message || t('admin.embeddingFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setBusy(true)
    setResult(null)
    try {
      const payload: PlacePayload = {
        ...form,
        tags: tagsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        embedding: embedding || undefined,
        compute_embedding: !embedding, // if no embedding, compute on server
      }
      
      // Only include fields that have actually changed
      const changedPayload: PlacePayload = {}
      
      if (form.name !== originalPlace?.name) changedPayload.name = form.name
      if (form.description !== originalPlace?.description) changedPayload.description = form.description
      if (form.name_th !== (originalPlace?.name_th || '')) changedPayload.name_th = form.name_th
      if (form.description_th !== (originalPlace?.description_th || '')) changedPayload.description_th = form.description_th
      if (form.address !== originalPlace?.address) changedPayload.address = form.address
      if (form.image_url !== originalPlace?.image_url) changedPayload.image_url = form.image_url
      
      if (form.lat !== originalPlace?.lat) changedPayload.lat = form.lat ? Number(form.lat) : undefined
      if (form.lng !== originalPlace?.lng) changedPayload.lng = form.lng ? Number(form.lng) : undefined
      if (form.price !== originalPlace?.price) changedPayload.price = form.price ? Number(form.price) : undefined
      
      const newTags = tagsText.split(',').map(s => s.trim()).filter(Boolean)
      const originalTags = originalPlace?.tags || []
      if (JSON.stringify(newTags) !== JSON.stringify(originalTags)) {
        changedPayload.tags = newTags
      }
      
      // Detail fields: send each one that changed (opening hours are replaced as a whole)
      const nextDetails = placeDetailsToPayload(details)
      const prevDetails = placeDetailsToPayload(originalDetails)
      for (const key of Object.keys(nextDetails) as Array<keyof typeof nextDetails>) {
        if (JSON.stringify(nextDetails[key]) !== JSON.stringify(prevDetails[key])) {
          (changedPayload as any)[key] = nextDetails[key]
        }
      }

      if (embedding) {
        changedPayload.embedding = embedding
      } else if (changedPayload.name || changedPayload.description) {
        changedPayload.compute_embedding = true
      }
      
      // If no changes, show message
      if (Object.keys(changedPayload).length === 0) {
        setError(t('admin.noChanges'))
        return
      }

      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/places/${placeId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify(changedPayload),
      })
      
      const contentType = res.headers.get('content-type') || ''
      const j = contentType.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || t('admin.unexpectedResponse') }
      if (!res.ok || !j.success) throw new Error(j.error || t('admin.updateFailed'))
      
      setResult(j)
      alert(t('admin.updated') + (j.warning ? '\n' + t('admin.warning', { message: j.warning }) : ''))
      router.push('/admin/places')
    } catch (e: any) {
      setError(e?.message || t('admin.updateFailed'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (placeId) {
      fetchPlace()
    }
  }, [placeId])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('admin.loadingPlace')}</p>
        </div>
      </div>
    )
  }

  if (error && !originalPlace) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-4">{error}</p>
          <div className="space-x-3">
            <Button onClick={fetchPlace} className="bg-primary hover:bg-primary/90">
              {t('common.retry')}
            </Button>
            <Link href="/admin/places">
              <Button variant="outline">
                {t('admin.backToPlaces')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-10 sm:px-6 md:py-14">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/places">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('admin.backToPlaces')}
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">{t('admin.editTitle')}</h1>
            <p className="text-muted-foreground mt-1">{t('admin.editSubtitle')}</p>
          </div>
        </div>

        {originalPlace && (
          <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldNameEn')}</label>
                <Input 
                  value={form.name || ''} 
                  onChange={(e) => update('name', e.target.value)} 
                  placeholder="Wat Pho" 
                  className="" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldDescriptionEn')}</label>
                <Textarea 
                  value={form.description || ''} 
                  onChange={(e) => update('description', e.target.value)} 
                  rows={5} 
                  placeholder={t('admin.descriptionPlaceholder')} 
                  className="" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldNameTh')}</label>
                <Input 
                  value={form.name_th || ''} 
                  onChange={(e) => update('name_th', e.target.value)} 
                  placeholder="วัดโพธิ์" 
                  className="" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldDescriptionTh')}</label>
                <Textarea 
                  value={form.description_th || ''} 
                  onChange={(e) => update('description_th', e.target.value)} 
                  rows={5} 
                  placeholder={t('admin.descriptionThPlaceholder')} 
                  className="" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldLat')}</label>
                  <Input 
                    value={form.lat ?? ''} 
                    onChange={(e) => update('lat', e.target.value)} 
                    placeholder="13.746" 
                    type="number" 
                    step="any"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldLng')}</label>
                  <Input 
                    value={form.lng ?? ''} 
                    onChange={(e) => update('lng', e.target.value)} 
                    placeholder="100.535" 
                    type="number" 
                    step="any"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldAddress')}</label>
                <Input 
                  value={form.address || ''} 
                  onChange={(e) => update('address', e.target.value)} 
                  placeholder="Bangkok, Thailand" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldPrice')}</label>
                  <Input 
                    value={form.price ?? ''} 
                    onChange={(e) => update('price', e.target.value)} 
                    placeholder="200" 
                    type="number" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldImageUrl')}</label>
                  <Input 
                    value={form.image_url || ''} 
                    onChange={(e) => update('image_url', e.target.value)} 
                    placeholder="https://..." 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.fieldTags')}</label>
                <Input 
                  value={tagsText} 
                  onChange={(e) => setTagsText(e.target.value)} 
                  placeholder="temple, history, culture" 
                />
              </div>

              <div className="pt-4 border-t">
                <h2 className="text-lg font-semibold text-foreground mb-3">{t('admin.visitDetails')}</h2>
                <PlaceDetailsFields value={details} onChange={setDetails} />
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  onClick={handleGenerateEmbedding} 
                  disabled={busy || !form.name}
                  variant="outline"
                >
                  {t('admin.generateEmbedding')}
                </Button>
                <div className="text-sm text-muted-foreground">
                  {embedding ? t('admin.newEmbedding', { dims: String(embedding.length) }) : t('admin.embeddingAuto')}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  onClick={handleSubmit} 
                  disabled={busy || !form.name}
                  className="bg-primary hover:bg-primary/90"
                >
                  {busy ? t('admin.updating') : t('admin.updatePlace')}
                </Button>
                <Link href="/admin/places">
                  <Button variant="outline" disabled={busy}>
                    {t('admin.cancel')}
                  </Button>
                </Link>
              </div>

              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</div>}
              {result && (
                <div className="bg-teal-soft p-3 rounded">
                  <p className="text-primary text-sm font-medium mb-2">{t('admin.updateSuccess')}</p>
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-32">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
