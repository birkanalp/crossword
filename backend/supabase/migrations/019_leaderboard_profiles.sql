-- Migration: Leaderboard profiles + display_name snapshot on leaderboard_entries
-- Creates a public profiles table for user display names and avatar colours.
-- Adds display_name to leaderboard_entries as a snapshot at submission time so
-- leaderboard history is unaffected by future username changes.
-- Also adds performance indexes for leaderboard query patterns.

BEGIN;

-- -----------------------------------------------------------------------
-- profiles table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT        NOT NULL CHECK (char_length(username) >= 2 AND char_length(username) <= 20),
  avatar_color TEXT        NOT NULL DEFAULT '#6366F1',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Public user profile: display name and avatar colour. One row per auth user.';
COMMENT ON COLUMN public.profiles.username IS 'Unique display name, 2-20 characters, case-insensitively unique.';
COMMENT ON COLUMN public.profiles.avatar_color IS 'Hex colour for avatar circle, e.g. #6366F1.';
COMMENT ON COLUMN public.profiles.user_id IS 'FK to auth.users(id). Deleted when the auth user is deleted.';

-- Case-insensitive unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (LOWER(username));

-- Fast lookup by user_id (PK alternative for FK joins)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

-- updated_at trigger (uses fn_set_updated_at from migration 001 — moddatetime is NOT installed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_profiles_updated_at'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER trg_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END
$$;

-- -----------------------------------------------------------------------
-- RLS for profiles
-- -----------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read profiles (for leaderboard display names)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public' AND policyname = 'profiles_select_public'
  ) THEN
    CREATE POLICY "profiles_select_public" ON public.profiles
      FOR SELECT USING (true);
  END IF;
END
$$;

-- Authenticated users can insert their own profile (one per user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Users can update only their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- -----------------------------------------------------------------------
-- display_name column on leaderboard_entries
-- Snapshot of profiles.username at the moment of submitScore.
-- Null for pre-migration entries — API callers fall back to 'Anonim'.
-- -----------------------------------------------------------------------
ALTER TABLE public.leaderboard_entries
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN public.leaderboard_entries.display_name IS
  'Snapshot of the user''s username at submission time. Null for pre-migration entries (fall back to ''Anonim'' in API layer).';

-- -----------------------------------------------------------------------
-- Leaderboard performance indexes
-- -----------------------------------------------------------------------

-- Puzzle-scoped score leaderboard: (level_id, score DESC)
CREATE INDEX IF NOT EXISTS idx_leaderboard_level_score
  ON public.leaderboard_entries (level_id, score DESC);

-- Puzzle-scoped time leaderboard: (level_id, completion_time ASC)
CREATE INDEX IF NOT EXISTS idx_leaderboard_level_time
  ON public.leaderboard_entries (level_id, completion_time ASC);

-- Per-user best score lookup (all_time aggregation)
CREATE INDEX IF NOT EXISTS idx_leaderboard_user_score
  ON public.leaderboard_entries (user_id, score DESC);

-- Daily leaderboard: recent entries first, then score
CREATE INDEX IF NOT EXISTS idx_leaderboard_date_score
  ON public.leaderboard_entries (created_at DESC, score DESC);

COMMIT;
