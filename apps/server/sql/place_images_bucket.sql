-- Public bucket for re-hosted place photos (filled by `bun run db:images`)
-- Only the service role writes here, so there are no INSERT/UPDATE/DELETE policies for clients.

INSERT INTO storage.buckets (id, name, public)
VALUES ('place-images', 'place-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read objects in place-images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read place-images'
    ) THEN
        CREATE POLICY "Public read place-images"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'place-images');
    END IF;
END $$;
