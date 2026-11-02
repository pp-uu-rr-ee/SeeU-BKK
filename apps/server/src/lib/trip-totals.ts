import { fetchMapboxDirectionsRoute, haversineKm, round1, type LatLng } from './tools'

// Matches the stop-time fallback the web app shows for stops without a duration.
export const DEFAULT_STOP_MINUTES = 60

export interface TripTotalsStop {
  lat?: number | null
  lng?: number | null
  suggested_time_min?: number | null
}

export interface TripTotals {
  /** Distance from the previous located stop, one entry per input stop (0 for the first). */
  legs_km: number[]
  total_distance_km: number
  /** Time spent at stops plus walking time between them. */
  total_minutes: number
}

function hasCoords(stop: TripTotalsStop): stop is TripTotalsStop & LatLng {
  return typeof stop.lat === 'number' && Number.isFinite(stop.lat)
    && typeof stop.lng === 'number' && Number.isFinite(stop.lng)
}

/**
 * Server-side source of truth for saved trip totals, so every client
 * (new/edit dialogs, map, chat) gets the same distance and duration.
 * Uses Mapbox walking directions like the map page; falls back to
 * straight-line distance without travel time when Mapbox is unavailable.
 */
export async function computeTripTotals(stops: TripTotalsStop[]): Promise<TripTotals> {
  const stopMinutes = stops.reduce((sum, stop) => sum + (stop.suggested_time_min || DEFAULT_STOP_MINUTES), 0)
  const legs_km = stops.map(() => 0)

  const located = stops
    .map((stop, index) => ({ stop, index }))
    .filter((item): item is { stop: TripTotalsStop & LatLng; index: number } => hasCoords(item.stop))

  if (located.length < 2) {
    return { legs_km, total_distance_km: 0, total_minutes: stopMinutes }
  }

  const route = await fetchMapboxDirectionsRoute(
    located.map(({ stop }) => ({ lat: stop.lat, lng: stop.lng })),
    'walk'
  )

  if (route && route.legs.length === located.length - 1) {
    route.legs.forEach((leg, i) => {
      legs_km[located[i + 1]!.index] = leg.distance_km
    })
    const travelMinutes = route.total_mins ?? route.legs.reduce((sum, leg) => sum + (leg.duration_min || 0), 0)
    return { legs_km, total_distance_km: route.total_km, total_minutes: stopMinutes + travelMinutes }
  }

  let total = 0
  for (let i = 1; i < located.length; i++) {
    const km = haversineKm(located[i - 1]!.stop, located[i]!.stop)
    legs_km[located[i]!.index] = round1(km)
    total += km
  }
  return { legs_km, total_distance_km: round1(total), total_minutes: stopMinutes }
}
