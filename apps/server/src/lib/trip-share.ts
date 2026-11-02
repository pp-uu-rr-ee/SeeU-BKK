const SHARE_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isShareToken(value: string): boolean {
  return SHARE_TOKEN_PATTERN.test(value)
}

interface SharedTripSource {
  title: string
  total_minutes?: number | null
  total_distance_km?: number | null
  created_at?: string | null
}

/**
 * Whitelists the fields a shared trip link may show. Owner id, planning
 * context, trip id and the token itself never leave the server.
 */
export function toPublicTrip<TStop>(trip: SharedTripSource, stops: TStop[]) {
  return {
    title: trip.title,
    total_minutes: trip.total_minutes ?? null,
    total_distance_km: trip.total_distance_km ?? null,
    created_at: trip.created_at ?? null,
    stops,
  }
}
