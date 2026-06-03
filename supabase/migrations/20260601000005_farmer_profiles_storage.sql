-- Add image_url to farmers table
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS image_url text;

-- Insert into storage.buckets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('farmer-profiles', 'farmer-profiles', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Public Profile Access" ON storage.objects;
DROP POLICY IF EXISTS "Dealer Profile Upload" ON storage.objects;
DROP POLICY IF EXISTS "Dealer Profile Update" ON storage.objects;
DROP POLICY IF EXISTS "Dealer Profile Delete" ON storage.objects;

-- Create policies for farmer-profiles
-- 1. Public can read any farmer profile
CREATE POLICY "Public Profile Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'farmer-profiles' );

-- 2. Dealers can upload images to their own folder (folder name = dealer_id)
CREATE POLICY "Dealer Profile Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'farmer-profiles' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Dealers can update their own images
CREATE POLICY "Dealer Profile Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'farmer-profiles' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Dealers can delete their own images
CREATE POLICY "Dealer Profile Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'farmer-profiles' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
