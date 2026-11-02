/**
 * App roles live in Supabase app_metadata, which only the service role can change.
 * Not user_metadata (users can edit their own) and not the auth `role` claim: Supabase uses that
 * as the Postgres role for every request, so a value like 'admin' breaks storage/PostgREST calls.
 */
export function hasRole(user: unknown, role: string): boolean {
  const appMetadata = (user as { app_metadata?: { role?: unknown } | null } | null | undefined)?.app_metadata
  return appMetadata?.role === role
}
