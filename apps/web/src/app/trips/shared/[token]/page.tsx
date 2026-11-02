"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslation } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { TripDetailView, type TripDetail } from '@/components/trips/trip-detail-view'
import { Loader2, Map as MapIcon, Share2 } from 'lucide-react'

/** Public, read-only view of a trip its owner shared by link (no sign-in needed). */
export default function SharedTripPage() {
  const { t } = useTranslation()
  const params = useParams<{ token: string }>()
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [busy, setBusy] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

  useEffect(() => {
    if (!params?.token) return
    let cancelled = false
    setBusy(true)
    setNotFound(false)

    fetch(`${serverUrl}/api/itineraries/shared/${encodeURIComponent(params.token)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({ success: false }))
        if (cancelled) return
        if (!res.ok || !json.success) {
          setNotFound(true)
          return
        }
        setTrip(json.data)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })

    return () => {
      cancelled = true
    }
  }, [params?.token, serverUrl])

  return (
    <TripDetailView
      trip={trip}
      top={
        <p className="inline-flex items-center gap-2 py-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
          <Share2 className="h-4 w-4" aria-hidden />
          {t('savedTrips.sharedEyebrow')}
        </p>
      }
      status={
        busy ? (
          <div className="mt-8 flex items-center gap-3 text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
            {t('savedTrips.detailLoading')}
          </div>
        ) : notFound ? (
          <div className="mt-8 space-y-6">
            <p role="alert" className="text-lg text-muted-foreground">{t('savedTrips.sharedNotFound')}</p>
            <Button asChild className="h-11 rounded-full px-5">
              <Link href="/map">{t('savedTrips.planYourOwn')}</Link>
            </Button>
          </div>
        ) : null
      }
      actions={
        <Button asChild className="h-11 rounded-full px-5">
          <Link href="/map">
            <MapIcon className="h-4 w-4" aria-hidden />
            {t('savedTrips.planYourOwn')}
          </Link>
        </Button>
      }
    />
  )
}
