-- Public share links for saved trips.
-- A trip is public only while share_token is set; the API reads shared trips
-- with the service role, so RLS on itineraries stays owner-only.
-- Additive only: existing trips keep share_token = NULL (not shared).

ALTER TABLE itineraries
    ADD COLUMN IF NOT EXISTS share_token UUID;

CREATE UNIQUE INDEX IF NOT EXISTS itineraries_share_token_key
    ON itineraries (share_token)
    WHERE share_token IS NOT NULL;
