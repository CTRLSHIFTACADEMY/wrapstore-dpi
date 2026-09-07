-- ============================================================
-- WRAPSTORE — STAGE 0
-- CONNECTION VERIFICATION SCHEMA
-- Run this file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. SYSTEM CONNECTION TEST TABLE
--    Used exclusively by the SystemStatus diagnostic page
--    to verify READ / WRITE / UPDATE / DELETE against PostgreSQL
-- ============================================================

CREATE TABLE IF NOT EXISTS system_connection_test (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index to speed up cleanup queries
CREATE INDEX IF NOT EXISTS idx_system_connection_test_created
  ON system_connection_test (created_at DESC);

-- ============================================================
-- 2. ROW LEVEL SECURITY — system_connection_test
--    Only authenticated users may access this table.
--    No public/anonymous access.
-- ============================================================

ALTER TABLE system_connection_test ENABLE ROW LEVEL SECURITY;

-- Authenticated users can SELECT (needed for READ test)
DROP POLICY IF EXISTS "Authenticated can select connection test" ON system_connection_test;
CREATE POLICY "Authenticated can select connection test"
  ON system_connection_test FOR SELECT
  TO authenticated
  USING (TRUE);

-- Authenticated users can INSERT (needed for WRITE test)
DROP POLICY IF EXISTS "Authenticated can insert connection test" ON system_connection_test;
CREATE POLICY "Authenticated can insert connection test"
  ON system_connection_test FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Authenticated users can UPDATE (needed for UPDATE test)
DROP POLICY IF EXISTS "Authenticated can update connection test" ON system_connection_test;
CREATE POLICY "Authenticated can update connection test"
  ON system_connection_test FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- Authenticated users can DELETE (needed for DELETE test + cleanup)
DROP POLICY IF EXISTS "Authenticated can delete connection test" ON system_connection_test;
CREATE POLICY "Authenticated can delete connection test"
  ON system_connection_test FOR DELETE
  TO authenticated
  USING (TRUE);

-- ============================================================
-- 3. SUPABASE STORAGE — product-images BUCKET
--    Creates the bucket if it does not already exist.
--    Public = TRUE so product image URLs are publicly readable.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  5242880,   -- 5 MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. STORAGE RLS POLICIES — product-images
--    Authenticated users can upload, read, update, delete.
--    Public can read (so image URLs work without a signed token).
-- ============================================================

-- Allow public read access to product images
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated users can upload
DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
CREATE POLICY "Authenticated upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Authenticated users can update (upsert)
DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
CREATE POLICY "Authenticated update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

-- Authenticated users can delete
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;
CREATE POLICY "Authenticated delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');

-- ============================================================
-- DONE
-- After running this script, navigate to:
-- WrapStore → Settings → System Status
-- to verify the complete connection chain.
-- ============================================================
