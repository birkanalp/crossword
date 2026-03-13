-- =============================================================================
-- Migration: 023_storage_avatars_bucket.sql
-- Creates the 'avatars' storage bucket with RLS policies.
--
-- Bucket is PUBLIC (avatar images can be viewed by anyone for leaderboard)
-- but only the owning user may upload/update/delete their own avatar.
--
-- Object naming convention: avatars/<user_id>/<filename>
-- =============================================================================

-- Create the avatars bucket (public = readable by anyone without auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,           -- public read
  5242880,        -- 5 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- Anyone can read avatar images (public bucket)
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Only authenticated owners can upload their own avatars
-- Object path must start with their user ID: avatars/<user_id>/...
CREATE POLICY "avatars_owner_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Only the owner can update their own avatar
CREATE POLICY "avatars_owner_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Only the owner can delete their own avatar
CREATE POLICY "avatars_owner_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
