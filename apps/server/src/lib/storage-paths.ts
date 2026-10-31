const USER_UPLOADS_PREFIX = '/storage/v1/object/public/user-uploads/'

/**
 * Object path inside the `user-uploads` bucket for an avatar URL we host
 * (e.g. `avatars/abc_123.png`), or null for external, non-avatar or empty URLs.
 */
export function avatarStoragePath(url: string | null | undefined): string | null {
  if (!url) return null
  const start = url.indexOf(USER_UPLOADS_PREFIX + 'avatars/')
  if (start === -1) return null
  const path = url.slice(start + USER_UPLOADS_PREFIX.length).split(/[?#]/)[0]
  return path.length > 'avatars/'.length ? path : null
}

/**
 * Avatar object to delete after a profile save, or null when nothing may be deleted:
 * the avatar is unchanged, external, or another profile still points at the same file
 * (avatar_url accepts any URL, so a user could reference someone else's upload).
 */
export function replacedAvatarPath(
  previousUrl: string | null | undefined,
  savedUrl: string | null | undefined,
  stillReferenced: boolean
): string | null {
  if (stillReferenced || previousUrl === savedUrl) return null
  return avatarStoragePath(previousUrl)
}
