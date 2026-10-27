"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useTranslation } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, Clock3, ExternalLink, ImageOff, Loader2, Pencil, Route, Share2 } from 'lucide-react'
import { toast } from 'sonner'

type Stop = {
  id: string
  position: number
  suggested_time_min?: number
  distance_from_prev_km?: number
  notes?: string
  place: { id: string; name: string; lat?: number; lng?: number; tags?: string[]; image_url?: string | null }
}

type Trip = {
  id: string
  title: string
  created_at?: string
  total_minutes?: number
  total_distance_km?: number
  stops: Stop[]
}

const DAY_START_MINUTES = 9 * 60

/** "09:00" style 24h clock (common in Thailand, unambiguous in English) */
const formatClock = (totalMinutes: number) => {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isHttpUrl(value?: string | null): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

/** Mapbox static map with a numbered pin per stop */
function buildStaticMapUrl(stops: Stop[]) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const pins = stops
    .filter((s) => typeof s.place?.lat === 'number' && typeof s.place?.lng === 'number')
    .slice(0, 20)
    .map((s, i) => `pin-s-${Math.min(i + 1, 99)}+0e5a5f(${s.place.lng},${s.place.lat})`)
  if (!token || pins.length === 0) return null
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${pins.join(',')}/auto/640x400@2x?padding=48&access_token=${token}`
}

export default function SavedTripDetailPage() {
  const { session, loading } = useAuth()
  const { t, locale } = useTranslation()
  const params = useParams<{ id: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const isAuthed = !!session?.access_token

  useEffect(() => {
    const loadTrip = async () => {
      if (!session?.access_token || !params?.id) return
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`${serverUrl}/api/itineraries/${params.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        const contentType = res.headers.get('content-type') || ''
        const json = contentType.includes('application/json')
          ? await res.json()
          : { success: false, error: (await res.text()) || 'Bad response' }

        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load itinerary')
        setTrip(json.data || null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load itinerary')
      } finally {
        setBusy(false)
      }
    }

    if (isAuthed) loadTrip()
  }, [isAuthed, params?.id, serverUrl, session?.access_token])

  const timelineStops = useMemo(() => {
    if (!trip?.stops?.length) return []
    let running = DAY_START_MINUTES

    return trip.stops.map((stop) => {
      const timeLabel = formatClock(running)
      running += stop.suggested_time_min || 60
      return { ...stop, timeLabel }
    })
  }, [trip])

  const staticMapUrl = useMemo(() => (trip ? buildStaticMapUrl(trip.stops || []) : null), [trip])
  const createdDate = trip?.created_at ? new Date(trip.created_at) : null
  const dateLabel = createdDate?.toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium' })

  const handleShare = async () => {
    try {
      if (navigator.share && trip) {
        await navigator.share({ title: trip.title, url: window.location.href })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        toast.success(t('savedTrips.linkCopied'))
      }
    } catch {
      // User cancelled the share sheet
    }
  }

  // Google Maps directions through every stop that has coordinates
  const openRoute = () => {
    const points = (trip?.stops || [])
      .filter((s) => typeof s.place?.lat === 'number' && typeof s.place?.lng === 'number')
      .map((s) => `${s.place.lat},${s.place.lng}`)
    if (points.length === 0) {
      toast.error(t('savedTrips.noCoords'))
      return
    }
    const url = points.length === 1
      ? `https://www.google.com/maps?q=${points[0]}`
      : `https://www.google.com/maps/dir/${points.join('/')}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!isAuthed && !loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft text-primary">
          <Route className="h-7 w-7" aria-hidden />
        </span>
        <p className="text-muted-foreground">{t('savedTrips.detailSignIn')}</p>
        <Button asChild className="mt-6 h-12 rounded-full px-7 text-base">
          <Link href="/auth/login">{t('nav.signIn')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background pb-20">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
          <Link href="/saved-trips" className="inline-flex items-center gap-2 rounded-full py-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('savedTrips.detailBack')}
          </Link>

          {busy ? (
            <div className="mt-8 flex items-center gap-3 text-muted-foreground" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
              {t('savedTrips.detailLoading')}
            </div>
          ) : error ? (
            <div role="alert" className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
          ) : trip ? (
            <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                {dateLabel && (
                  <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                    <Calendar className="h-4 w-4" aria-hidden />
                    {dateLabel}
                  </p>
                )}
                <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{trip.title}</h1>
                <p className="mt-3 text-muted-foreground">
                  {t('savedTrips.detailSummary', { stops: String(trip.stops?.length || 0), minutes: String(trip.total_minutes || 0) })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-11 rounded-full border-border bg-card px-5" onClick={handleShare}>
                  <Share2 className="h-4 w-4" aria-hidden />
                  {t('savedTrips.share')}
                </Button>
                <Button asChild className="h-11 rounded-full px-5">
                  <Link href="/map">
                    <Pencil className="h-4 w-4" aria-hidden />
                    {t('savedTrips.editInPlanner')}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {trip && (
        <main className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby="schedule-heading" className="min-w-0">
            <div className="mb-8 flex items-baseline justify-between border-b border-border pb-4">
              <h2 id="schedule-heading" className="font-display text-2xl font-semibold text-foreground">{t('savedTrips.schedule')}</h2>
              <span className="text-sm text-muted-foreground">{t('savedTrips.day1')} · {t('savedTrips.startsAt')}</span>
            </div>

            <ol className="relative space-y-6 before:absolute before:bottom-6 before:left-[3.25rem] before:top-6 before:w-px before:bg-border sm:before:left-[4.25rem]">
              {timelineStops.map((stop) => {
                const imageOk = isHttpUrl(stop.place?.image_url) && !failedImages.has(stop.id)
                return (
                  <li key={stop.id} className="relative flex gap-4 sm:gap-6">
                    <div className="relative z-10 flex w-14 shrink-0 flex-col items-center pt-3 sm:w-[4.5rem]">
                      <span className="rounded-full bg-background px-1 text-sm font-semibold tabular-nums text-foreground">{stop.timeLabel}</span>
                      <span className="mt-2 h-3 w-3 rounded-full border-2 border-primary bg-background" aria-hidden />
                    </div>

                    <article className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card sm:flex-row">
                      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-teal-soft sm:aspect-auto sm:w-44">
                        {imageOk ? (
                          <img
                            src={stop.place.image_url!}
                            alt=""
                            loading="lazy"
                            onError={() => setFailedImages((prev) => new Set(prev).add(stop.id))}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full min-h-28 items-center justify-center text-primary/40">
                            <ImageOff className="h-7 w-7" aria-hidden />
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-primary">
                          {t('savedTrips.stopN', { n: String(stop.position) })}
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-center p-5">
                        {stop.place?.tags?.[0] && (
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{stop.place.tags[0].replace(/-/g, ' ')}</p>
                        )}
                        <h3 className="mt-1 font-display text-xl font-semibold text-foreground">{stop.place?.name || t('savedTrips.untitledStop')}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-4 w-4" aria-hidden />
                            {t('savedTrips.minutesShort', { n: String(stop.suggested_time_min || 60) })}
                          </span>
                          {typeof stop.distance_from_prev_km === 'number' && stop.distance_from_prev_km > 0 && (
                            <span>{t('savedTrips.fromPrev', { km: stop.distance_from_prev_km.toFixed(1) })}</span>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {stop.notes?.trim() ? stop.notes : t('savedTrips.noNotes')}
                        </p>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ol>
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="aspect-[4/3] bg-teal-soft">
                {staticMapUrl ? (
                  <img src={staticMapUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary/40">
                    <Route className="h-10 w-10" aria-hidden />
                  </div>
                )}
              </div>
              <div className="p-5">
                <h2 className="font-medium text-foreground">{t('savedTrips.overview')}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-secondary p-3">
                    <dt className="text-muted-foreground">{t('common.stops')}</dt>
                    <dd className="font-display text-2xl font-semibold text-foreground">{trip.stops?.length || 0}</dd>
                  </div>
                  <div className="rounded-xl bg-secondary p-3">
                    <dt className="text-muted-foreground">{t('common.km')}</dt>
                    <dd className="font-display text-2xl font-semibold text-foreground">{trip.total_distance_km || 0}</dd>
                  </div>
                </dl>
                <Button variant="secondary" className="mt-4 h-11 w-full rounded-full" onClick={openRoute}>
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {t('savedTrips.openRoute')}
                </Button>
              </div>
            </div>
          </aside>
        </main>
      )}
    </div>
  )
}
