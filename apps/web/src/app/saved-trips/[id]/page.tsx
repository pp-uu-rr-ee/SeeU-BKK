"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useTranslation } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TripDetailView, type TripDetail } from '@/components/trips/trip-detail-view'
import { sharedTripUrl } from '@/lib/trip-share-link'
import { ArrowLeft, Copy, Link2Off, Loader2, Pencil, Route, Share2 } from 'lucide-react'
import { toast } from 'sonner'

type Trip = TripDetail & {
  id: string
  share_token?: string | null
}

export default function SavedTripDetailPage() {
  const { session, loading } = useAuth()
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const isAuthed = !!session?.access_token
  const shareToken = trip?.share_token ?? null
  const shareUrl = shareToken && typeof window !== 'undefined' ? sharedTripUrl(window.location.origin, shareToken) : null

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

  // Turns sharing on (POST) or off (DELETE) and keeps the token in local state
  const setSharing = async (enabled: boolean) => {
    if (!trip || !session?.access_token) return
    setShareBusy(true)
    try {
      const res = await fetch(`${serverUrl}/api/itineraries/${trip.id}/share`, {
        method: enabled ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json().catch(() => ({ success: false }))
      if (!res.ok || !json.success) throw new Error(json.error)
      setTrip((prev) => (prev ? { ...prev, share_token: json.data?.share_token ?? null } : prev))
      if (!enabled) {
        toast.success(t('savedTrips.sharingStopped'))
        setShareOpen(false)
      }
    } catch {
      toast.error(t('savedTrips.shareFailed'))
    } finally {
      setShareBusy(false)
    }
  }

  const copyShareUrl = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success(t('savedTrips.linkCopied'))
    } catch {
      toast.error(t('savedTrips.copyFailed'))
    }
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
    <>
      <TripDetailView
        trip={trip}
        top={
          <Link href="/saved-trips" className="inline-flex items-center gap-2 rounded-full py-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('savedTrips.detailBack')}
          </Link>
        }
        status={
          busy ? (
            <div className="mt-8 flex items-center gap-3 text-muted-foreground" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
              {t('savedTrips.detailLoading')}
            </div>
          ) : error ? (
            <div role="alert" className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
          ) : null
        }
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full border-border bg-card px-5" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4" aria-hidden />
              {shareToken ? t('savedTrips.shared') : t('savedTrips.share')}
            </Button>
            <Button asChild className="h-11 rounded-full px-5">
              <Link href={`/map?trip=${encodeURIComponent(params.id)}`}>
                <Pencil className="h-4 w-4" aria-hidden />
                {t('savedTrips.editInPlanner')}
              </Link>
            </Button>
          </>
        }
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('savedTrips.shareTitle')}</DialogTitle>
            <DialogDescription>
              {shareToken ? t('savedTrips.shareActiveDesc') : t('savedTrips.shareConfirmDesc')}
            </DialogDescription>
          </DialogHeader>

          {shareUrl && (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                aria-label={t('savedTrips.shareLinkLabel')}
                onFocus={(e) => e.currentTarget.select()}
                className="h-11"
              />
              <Button className="h-11 shrink-0 rounded-full px-4" onClick={copyShareUrl}>
                <Copy className="h-4 w-4" aria-hidden />
                {t('savedTrips.copyLink')}
              </Button>
            </div>
          )}

          <DialogFooter>
            {shareToken ? (
              <Button variant="ghost" className="h-11 rounded-full text-destructive" disabled={shareBusy} onClick={() => setSharing(false)}>
                <Link2Off className="h-4 w-4" aria-hidden />
                {t('savedTrips.stopSharing')}
              </Button>
            ) : (
              <>
                <Button variant="ghost" className="h-11 rounded-full" onClick={() => setShareOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button className="h-11 rounded-full px-5" disabled={shareBusy} onClick={() => setSharing(true)}>
                  {shareBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {t('savedTrips.createShareLink')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
