/**
 * Admin access comes from Supabase app_metadata.role only (set by the server, not editable by users).
 * See apps/server/src/middleware/roles.ts for why user_metadata and the auth `role` claim are not used.
 */
export function isAdmin(user: unknown): boolean {
  const appMetadata = (user as { app_metadata?: { role?: unknown } | null } | null | undefined)?.app_metadata
  return appMetadata?.role === 'admin'
}
