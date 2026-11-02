/** Public link for a shared trip; the route lives at app/trips/shared/[token]. */
export function sharedTripUrl(origin: string, shareToken: string): string {
  return `${origin.replace(/\/+$/, '')}/trips/shared/${encodeURIComponent(shareToken)}`
}
