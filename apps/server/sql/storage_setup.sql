-- Setup script for Supabase Storage

-- 1. Create the user-uploads bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up Row Level Security policies for storage.objects
-- Note: Supabase enables RLS on storage.objects by default, so we need to add policies.

-- Allow public to read objects in user-uploads
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-uploads');

-- Allow authenticated users to upload to user-uploads
CREATE POLICY "Authenticated Users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-uploads');

-- Allow authenticated users to update their own uploads
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'user-uploads' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'user-uploads' AND auth.uid() = owner);

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-uploads' AND auth.uid() = owner);
