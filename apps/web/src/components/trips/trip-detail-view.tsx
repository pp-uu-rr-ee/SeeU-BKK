"use client"

import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { Calendar, Clock3, ExternalLink, ImageOff, Route } from 'lucide-react'
import { toast } from 'sonner'

export type TripDetailStop = {
  id: string
  position: number
  suggested_time_min?: number
  distance_from_prev_km?: number
  notes?: string
  place: { id: string; name: string; lat?: number; lng?: number; tags?: string[]; image_url?: string | null }
}

export type TripDetail = {
  title: string
  created_at?: string | null
  total_minutes?: number | null
  total_distance_km?: number | null
  stops: TripDetailStop[]
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
function buildStaticMapUrl(stops: TripDetailStop[]) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const pins = stops
    .filter((s) => typeof s.place?.lat === 'number' && typeof s.place?.lng === 'number')
    .slice(0, 20)
    .map((s, i) => `pin-s-${Math.min(i + 1, 99)}+0e5a5f(${s.place.lng},${s.place.lat})`)
  if (!token || pins.length === 0) return null
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${pins.join(',')}/auto/640x400@2x?padding=48&access_token=${token}`
}

/**
 * Read-only trip itinerary used by the owner's detail page and the public
 * shared-trip page. `top` sits above the title (back link / eyebrow),
 * `status` replaces the title while loading or on error, `actions` sits
 * beside the title.
 */
export function TripDetailView({
  trip,
  top,
  status,
  actions,
}: {
  trip: TripDetail | null
  top?: ReactNode
  status?: ReactNode
  actions?: ReactNode
}) {
  const { t, locale } = useTranslation()
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

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

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background pb-20">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
          {top}

          {status ? (
            status
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

              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          ) : null}
        </div>
      </header>

      {trip && !status && (
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
