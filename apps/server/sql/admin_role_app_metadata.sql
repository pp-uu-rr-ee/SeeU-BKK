-- Move the admin flag into app_metadata (apply_migration "admin_role_app_metadata")
--
-- auth.users.role becomes the JWT `role` claim, which Supabase uses as the Postgres role for
-- storage/PostgREST requests. 'admin' is not a Postgres role, so every browser request from an
-- account with role = 'admin' failed ("role \"admin\" does not exist", SQLSTATE 22023).
-- user_metadata is editable by users themselves, so it must not grant admin either.
-- The app now reads app_metadata.role only (server roleGuard, web isAdmin).

-- 1. Grant admin through app_metadata to everyone who had it either way
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE role = 'admin' OR raw_user_meta_data->>'role' = 'admin';

-- 2. Restore the real Postgres role so the account's requests work again
UPDATE auth.users
SET role = 'authenticated'
WHERE role = 'admin';

-- user_metadata.role is left in place (no data removed); the app ignores it now.
-- Signed-in admins must sign out and back in to get a token with the new claims.
