"use client"

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/contexts/language-context'

const DAYS = [0, 1, 2, 3, 4, 5, 6]

type DayStatus = 'unknown' | 'open' | 'closed'

export type OpeningHourInput = {
  day_of_week: number
  status: DayStatus
  open_time: string
  close_time: string
}

export type PlaceDetailsValue = {
  phone: string
  website: string
  suggested_duration_min: string
  best_for: string
  is_published: boolean
  hours: OpeningHourInput[]
}

export function emptyPlaceDetails(): PlaceDetailsValue {
  return {
    phone: '',
    website: '',
    suggested_duration_min: '',
    best_for: '',
    is_published: true,
    hours: DAYS.map((day) => ({ day_of_week: day, status: 'unknown', open_time: '09:00', close_time: '17:00' })),
  }
}

/** Build form state from a place returned by GET /api/admin/places/:id */
export function placeDetailsFromApi(place: any): PlaceDetailsValue {
  const base = emptyPlaceDetails()
  const rows: any[] = Array.isArray(place?.opening_hours) ? place.opening_hours : []
  return {
    phone: place?.phone || '',
    website: place?.website || '',
    suggested_duration_min: place?.suggested_duration_min ? String(place.suggested_duration_min) : '',
    best_for: Array.isArray(place?.best_for) ? place.best_for.join(', ') : '',
    is_published: place?.is_published ?? true,
    hours: base.hours.map((h) => {
      const row = rows.find((r) => r.day_of_week === h.day_of_week)
      if (!row) return h
      return {
        day_of_week: h.day_of_week,
        status: row.is_closed ? 'closed' : 'open',
        open_time: row.open_time ? String(row.open_time).slice(0, 5) : h.open_time,
        close_time: row.close_time ? String(row.close_time).slice(0, 5) : h.close_time,
      }
    }),
  }
}

/** Convert form state into the API payload fields */
export function placeDetailsToPayload(value: PlaceDetailsValue) {
  const duration = parseInt(value.suggested_duration_min, 10)
  return {
    phone: value.phone.trim() || null,
    website: value.website.trim() || null,
    suggested_duration_min: Number.isFinite(duration) && duration > 0 ? duration : null,
    best_for: value.best_for.split(',').map((s) => s.trim()).filter(Boolean),
    is_published: value.is_published,
    opening_hours: value.hours
      .filter((h) => h.status !== 'unknown')
      .map((h) => ({
        day_of_week: h.day_of_week,
        is_closed: h.status === 'closed',
        open_time: h.status === 'open' ? h.open_time : null,
        close_time: h.status === 'open' ? h.close_time : null,
      })),
  }
}

interface PlaceDetailsFieldsProps {
  value: PlaceDetailsValue
  onChange: (value: PlaceDetailsValue) => void
}

export function PlaceDetailsFields({ value, onChange }: PlaceDetailsFieldsProps) {
  const { t } = useTranslation()
  const set = <K extends keyof PlaceDetailsValue>(key: K, v: PlaceDetailsValue[K]) => onChange({ ...value, [key]: v })
  const setHour = (day: number, patch: Partial<OpeningHourInput>) =>
    set('hours', value.hours.map((h) => (h.day_of_week === day ? { ...h, ...patch } : h)))

  // Copy Monday's hours to every day (most places share one schedule)
  const applyMondayToAll = () => {
    const monday = value.hours[1]
    set('hours', value.hours.map((h) => ({ ...monday, day_of_week: h.day_of_week })))
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.phone')}</label>
          <Input value={value.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+66 2 123 4567" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.website')}</label>
          <Input value={value.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." type="url" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.suggestedDuration')}</label>
          <Input
            value={value.suggested_duration_min}
            onChange={(e) => set('suggested_duration_min', e.target.value)}
            placeholder="90"
            type="number"
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground/80">{t('admin.bestFor')}</label>
          <Input value={value.best_for} onChange={(e) => set('best_for', e.target.value)} placeholder="families, photographers" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground/80">
        <input
          type="checkbox"
          checked={value.is_published}
          onChange={(e) => set('is_published', e.target.checked)}
          className="h-4 w-4"
        />
        {t('admin.publishedVisible')}
      </label>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-foreground/80">{t('admin.openingHours')}</label>
          <Button type="button" variant="outline" size="sm" onClick={applyMondayToAll}>
            {t('admin.copyMonday')}
          </Button>
        </div>
        <div className="rounded-lg border divide-y">
          {value.hours.map((h) => (
            <div key={h.day_of_week} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="w-24 text-sm text-foreground/80">{t(`placeDetail.days.${h.day_of_week}`)}</span>
              <select
                value={h.status}
                onChange={(e) => setHour(h.day_of_week, { status: e.target.value as DayStatus })}
                aria-label={t(`placeDetail.days.${h.day_of_week}`)}
                className="h-9 rounded-md border border-border bg-card px-2 text-sm"
              >
                <option value="unknown">{t('admin.hoursNotSet')}</option>
                <option value="open">{t('admin.hoursOpen')}</option>
                <option value="closed">{t('admin.hoursClosed')}</option>
              </select>
              {h.status === 'open' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={h.open_time}
                    onChange={(e) => setHour(h.day_of_week, { open_time: e.target.value })}
                    aria-label={t('admin.openTime', { day: t(`placeDetail.days.${h.day_of_week}`) })}
                    className="h-9 w-32"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={h.close_time}
                    onChange={(e) => setHour(h.day_of_week, { close_time: e.target.value })}
                    aria-label={t('admin.closeTime', { day: t(`placeDetail.days.${h.day_of_week}`) })}
                    className="h-9 w-32"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('admin.overnightHint')}</p>
      </div>
    </div>
  )
}
