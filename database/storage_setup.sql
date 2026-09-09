-- ============================================================
-- SUPABASE STORAGE BUCKET & RLS POLICIES FOR WRAPSTORE
-- Execute in Supabase SQL Editor to enable product-images uploads
-- ============================================================

-- 1. Create product-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- 2. Enable public read access for product-images
DROP POLICY IF EXISTS "Public Read Access for Product Images" ON storage.objects;
CREATE POLICY "Public Read Access for Product Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- 3. Enable authenticated upload access
DROP POLICY IF EXISTS "Authenticated Upload Access for Product Images" ON storage.objects;
CREATE POLICY "Authenticated Upload Access for Product Images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- 4. Enable authenticated update access
DROP POLICY IF EXISTS "Authenticated Update Access for Product Images" ON storage.objects;
CREATE POLICY "Authenticated Update Access for Product Images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

-- 5. Enable authenticated delete access
DROP POLICY IF EXISTS "Authenticated Delete Access for Product Images" ON storage.objects;
CREATE POLICY "Authenticated Delete Access for Product Images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');
