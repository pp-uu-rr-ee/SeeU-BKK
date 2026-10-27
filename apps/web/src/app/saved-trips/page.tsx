"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { Clock3, ListChecks, Edit, Trash2, Plus, Search, ArrowRight, MapPinned, CalendarDays, Heart, Star, Loader2, Route, ImageOff, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { NewTripDialog } from '@/components/trips/new-trip-dialog'
import { EditTripDialog } from '@/components/trips/edit-trip-dialog'
import { useTranslation } from '@/contexts/language-context'

type Stop = {
  id: string
  position: number
  suggested_time_min?: number
  distance_from_prev_km?: number
  notes?: string
  place: { id: string; name: string; lat?: number; lng?: number; tags?: string[] }
}

type FavoritePlace = {
  id: string
  name: string
  name_th?: string | null
  slug: string
  image_url: string
  tags: string[]
  avg_rating: number | null
  review_count: number
}

type Trip = {
  id: string
  title: string
  created_at?: string
  total_minutes?: number
  total_distance_km?: number
  stops: Stop[]
}

export default function SavedTripsPage() {
  const { t, locale } = useTranslation()
  const { session, loading } = useAuth()
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)
  const [isNewTripDialogOpen, setIsNewTripDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'short' | 'long'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTripId, setActiveTripId] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<FavoritePlace[]>([])

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const isAuthed = !!session?.access_token

  const fetchTrips = async () => {
    if (!session?.access_token) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${serverUrl}/api/itineraries`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const contentType = res.headers.get('content-type') || ''
      const j = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || 'Bad response' }
      if (!res.ok || !j.success) throw new Error(j.error || 'Failed to load trips')
      setTrips(j.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load trips')
    } finally {
      setBusy(false)
    }
  }

  const fetchFavorites = async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch(`${serverUrl}/api/favorites`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const j = await res.json()
      if (res.ok && j.success) setFavorites(j.data || [])
    } catch (e) {
      console.error('Failed to load favorites:', e)
    }
  }

  const handleRemoveFavorite = async (placeId: string) => {
    if (!session?.access_token) return
    const previous = favorites
    setFavorites((prev) => prev.filter((p) => p.id !== placeId))
    try {
      const res = await fetch(`${serverUrl}/api/favorites/${placeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(t("placeDetail.removedFavorite"))
    } catch (e) {
      setFavorites(previous)
      toast.error(t("placeDetail.favoriteFailed"))
    }
  }

  useEffect(() => {
    if (isAuthed) {
      fetchTrips()
      fetchFavorites()
    }
  }, [isAuthed])

  useEffect(() => {
    if (!trips.length) {
      setActiveTripId(null)
      return
    }
    setActiveTripId((prev) => (prev && trips.some((trip) => trip.id === prev) ? prev : trips[0].id))
  }, [trips])

  const totalStops = useMemo(() => trips.reduce((acc, trip) => acc + (trip.stops?.length || 0), 0), [trips])

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    const searched = !q
      ? trips
      : trips.filter((trip) => {
          const inTitle = trip.title.toLowerCase().includes(q)
          const inStops = trip.stops?.some((s) => s.place?.name?.toLowerCase().includes(q))
          return inTitle || inStops
        })

    if (activeTab === 'all') return searched
    if (activeTab === 'recent') {
      return [...searched].sort((a, b) => {
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0
        return bd - ad
      })
    }
    if (activeTab === 'short') return searched.filter((trip) => (trip.stops?.length || 0) <= 3)
    return searched.filter((trip) => (trip.stops?.length || 0) > 3)
  }, [trips, searchQuery, activeTab])

  const activeTrip = useMemo(() => {
    const found = filteredTrips.find((trip) => trip.id === activeTripId)
    return found || filteredTrips[0] || null
  }, [filteredTrips, activeTripId])

  const activeTripStops = activeTrip?.stops?.length || 0

  const formatTripDate = (value?: string, detailed = false) => {
    if (!value) return detailed ? t("common.noCreationDate") : '—'
    return new Date(value).toLocaleString(undefined, detailed ? undefined : { dateStyle: 'medium' })
  }

  const handleEditTrip = (trip: Trip) => {
    setEditingTrip(trip)
  }

  const handleDelete = async (tripId: string) => {
    if (!session?.access_token) return
    if (!confirm(t("savedTrips.deleteConfirm"))) return
    setDeletingTripId(tripId)
    try {
      const res = await fetch(`${serverUrl}/api/itineraries/${tripId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const contentType = res.headers.get('content-type') || ''
      const json = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || 'Bad response' }
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete trip')
      toast.success(t("savedTrips.deleteSuccess"))
      await fetchTrips()
    } catch (e: any) {
      toast.error(`${t("savedTrips.deleteError")}: ${e?.message || 'Unknown error'}`)
    } finally {
      setDeletingTripId(null)
    }
  }

  const handleViewDetail = (trip: Trip) => {
    router.push(`/saved-trips/${trip.id}`)
  }

  if (!isAuthed && !loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft text-primary">
          <Route className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">{t("nav.savedTrips")}</h1>
        <p className="mt-3 text-muted-foreground">{t("savedTrips.signInPrompt")}</p>
        <Button asChild className="mt-6 h-12 rounded-full px-7 text-base">
          <Link href="/auth/login">{t("nav.signIn")}</Link>
        </Button>
      </div>
    )
  }

  const tabs = [
    { id: 'all' as const, label: t("savedTrips.tabAll") },
    { id: 'recent' as const, label: t("savedTrips.tabRecent") },
    { id: 'short' as const, label: t("savedTrips.tabShort") },
    { id: 'long' as const, label: t("savedTrips.tabLong") },
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background pb-16">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-10 sm:px-6 md:pt-14">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
                {t("savedTrips.tripsCount", { count: String(trips.length) })} · {t("savedTrips.totalStops", { count: String(totalStops) })}
              </p>
              <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{t("savedTrips.pageTitle")}</h1>
              <p className="mt-3 max-w-xl text-muted-foreground">{t("savedTrips.pageSubtitle")}</p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl">
              <div className="relative flex-1">
                <label htmlFor="trip-search" className="sr-only">{t("savedTrips.searchPlaceholder")}</label>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  id="trip-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("savedTrips.searchPlaceholder")}
                  className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-base text-foreground shadow-card outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <Button onClick={() => setIsNewTripDialogOpen(true)} className="h-12 rounded-full px-6 text-base">
                <Plus className="h-5 w-5" aria-hidden />
                {t("savedTrips.newTrip")}
              </Button>
            </div>
          </div>

          <div className="mt-8 flex gap-2 overflow-x-auto" role="tablist" aria-label={t("savedTrips.pageTitle")}>
            {tabs.map((tab) => {
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/40'
                  )}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3" aria-label={t("savedTrips.pageTitle")}>
          {error && (
            <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
          )}

          {busy ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-8 text-muted-foreground" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
              {t("common.loading")}
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-soft text-primary">
                <Route className="h-6 w-6" aria-hidden />
              </span>
              <p className="text-muted-foreground">{t("savedTrips.noTrips")}</p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild className="h-11 rounded-full px-6">
                  <Link href="/map">{t("savedTrips.openPlanner")}</Link>
                </Button>
                <Button asChild variant="secondary" className="h-11 rounded-full px-6">
                  <Link href="/places">{t("savedTrips.browsePlaces")}</Link>
                </Button>
              </div>
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const isActive = activeTrip?.id === trip.id
              const stopCount = trip.stops?.length || 0

              return (
                <button
                  key={trip.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveTripId(trip.id)}
                  className={cn(
                    'w-full rounded-2xl border p-5 text-left transition-all',
                    isActive ? 'border-primary bg-card shadow-card ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate font-display text-xl font-semibold', isActive ? 'text-primary' : 'text-foreground')}>{trip.title}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <ListChecks className="h-4 w-4" aria-hidden />
                          {stopCount} {t("common.stops")}
                        </span>
                        {typeof trip.total_minutes === 'number' && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-4 w-4" aria-hidden />
                            {trip.total_minutes} {t("common.min")}
                          </span>
                        )}
                        {typeof trip.total_distance_km === 'number' && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPinned className="h-4 w-4" aria-hidden />
                            {trip.total_distance_km} {t("common.km")}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4" aria-hidden />
                          {formatTripDate(trip.created_at)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className={cn('mt-1 h-5 w-5 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                  </div>
                </button>
              )
            })
          )}
        </section>

        {activeTrip && (
          <aside>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card xl:sticky xl:top-24">
              <div className="relative overflow-hidden bg-primary p-6 text-primary-foreground">
                <div aria-hidden className="absolute -right-16 -top-16 h-40 w-40 rounded-full border-[18px] border-saffron/25" />
                <div className="relative mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-white/15 px-2.5 py-1">{activeTripStops} {t("common.stops")}</span>
                  {typeof activeTrip.total_distance_km === 'number' && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1">{activeTrip.total_distance_km} {t("common.km")}</span>
                  )}
                </div>
                <h2 className="relative font-display text-2xl font-semibold tracking-tight">{activeTrip.title}</h2>
                <p className="relative mt-1 text-sm text-primary-foreground/75">{formatTripDate(activeTrip.created_at, true)}</p>
              </div>

              <div className="space-y-6 p-6">
                <div>
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("savedTrips.stopsPreview")}</h3>
                  <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-3 before:top-3 before:w-px before:bg-border">
                    {activeTrip.stops?.slice(0, 5).map((stop, idx) => (
                      <li key={stop.id} className="relative flex items-start gap-3">
                        <span className="relative z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-soft text-xs font-semibold text-primary">
                          {idx + 1}
                        </span>
                        <span className="min-w-0 pt-0.5 text-foreground">{stop.place?.name || t("savedTrips.untitledStop")}</span>
                      </li>
                    ))}
                    {activeTripStops > 5 && (
                      <li className="pl-9 text-sm text-muted-foreground">{t("savedTrips.moreStops", { count: String(activeTripStops - 5) })}</li>
                    )}
                  </ol>
                </div>

                <div className="space-y-2.5">
                  <Button className="h-12 w-full rounded-full text-base" onClick={() => handleViewDetail(activeTrip)}>
                    {t("savedTrips.viewDetail")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" className="h-11 rounded-full" onClick={() => handleEditTrip(activeTrip)}>
                      <Edit className="h-4 w-4" aria-hidden />
                      {t("savedTrips.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDelete(activeTrip.id)}
                      disabled={deletingTripId === activeTrip.id}
                    >
                      {deletingTripId === activeTrip.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                      {deletingTripId === activeTrip.id ? t("savedTrips.deleting") : t("savedTrips.delete")}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl bg-accent/60 p-4 text-sm text-accent-foreground">
                  <p className="mb-1 font-medium">{t("savedTrips.tipTitle")}</p>
                  <p className="leading-relaxed text-accent-foreground/80">{t("savedTrips.tipDesc")}</p>
                </div>
              </div>
            </div>
          </aside>
        )}
      </main>

      <section className="mx-auto max-w-7xl border-t border-border px-4 pt-12 sm:px-6" aria-labelledby="favorites-heading">
        <div className="mb-6 flex items-center gap-3">
          <Heart className="h-6 w-6 fill-destructive/15 text-destructive" aria-hidden />
          <h2 id="favorites-heading" className="font-display text-3xl font-semibold tracking-tight text-foreground">{t("savedTrips.favoritesTitle")}</h2>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm text-muted-foreground">{favorites.length}</span>
        </div>
        {favorites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-muted-foreground">
            {t("savedTrips.favoritesEmpty")}{' '}
            <Link href="/places" className="font-medium text-primary hover:underline">{t("savedTrips.browsePlaces")}</Link>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {favorites.map((place) => (
              <li key={place.id} className="group relative">
                <Link href={`/places/${place.slug}`} className="block">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-teal-soft">
                    {place.image_url ? (
                      <img src={place.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-primary/40"><ImageOff className="h-8 w-8" aria-hidden /></div>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-1 font-display text-lg font-semibold text-foreground group-hover:text-primary">
                    {(locale === 'th' && place.name_th) || place.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    {place.avg_rating !== null ? (
                      <>
                        <Star className="h-4 w-4 fill-saffron text-saffron" aria-hidden />
                        {place.avg_rating.toFixed(1)} ({place.review_count})
                      </>
                    ) : (
                      t("placeDetail.noReviews")
                    )}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemoveFavorite(place.id)}
                  aria-label={`${t("savedTrips.removeFavorite")}: ${place.name}`}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-card/95 text-foreground shadow-card transition-colors hover:text-destructive"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EditTripDialog
        isOpen={editingTrip !== null}
        onClose={() => setEditingTrip(null)}
        onSuccess={fetchTrips}
        trip={editingTrip}
        serverUrl={serverUrl}
        sessionToken={session?.access_token || ''}
      />

      <NewTripDialog
        isOpen={isNewTripDialogOpen}
        onClose={() => setIsNewTripDialogOpen(false)}
        onSuccess={fetchTrips}
        serverUrl={serverUrl}
        sessionToken={session?.access_token || ''}
      />
    </div>
  )
}
