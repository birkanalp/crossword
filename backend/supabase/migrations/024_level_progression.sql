-- =============================================================================
-- Migration: 024_level_progression
-- Description: Level progression & unlock system
--   - Adds sort_order to levels (per-difficulty sequential numbering)
--   - Creates user_level_unlocks table (tracks which levels each user can play)
-- Date: 2026-03-16
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add sort_order to levels
-- ---------------------------------------------------------------------------
ALTER TABLE levels ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN levels.sort_order IS
  'Ascending display order within a difficulty group. 1-based. '
  'Set by admin when approving a puzzle. Used for progression unlock logic.';

-- Backfill: assign sort_order = row number ordered by created_at ASC within each difficulty
UPDATE levels
SET sort_order = sub.rn
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY target_difficulty
      ORDER BY created_at ASC
    ) AS rn
  FROM levels
  WHERE deleted_at IS NULL
) sub
WHERE levels.id = sub.id;

-- Unique index: no two active levels in the same difficulty can share a sort_order
CREATE UNIQUE INDEX IF NOT EXISTS uidx_levels_difficulty_sort_order
  ON levels (target_difficulty, sort_order)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Create user_level_unlocks
-- Tracks which levels are unlocked (playable) for each user/guest.
-- A row here = "this user may start this level."
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_level_unlocks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id    UUID,                                           -- client-generated UUID, no FK
  level_id    UUID        NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one of user_id / guest_id must be set
  CONSTRAINT chk_unlock_owner CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL) OR
    (user_id IS NULL     AND guest_id IS NOT NULL)
  )
);

COMMENT ON TABLE user_level_unlocks IS
  'One row per (user, level) pair that has been unlocked via the progression system. '
  'Separate from is_premium — premium levels also need an unlock row to be playable.';

-- Unique per authenticated user per level
CREATE UNIQUE INDEX IF NOT EXISTS uidx_unlock_user_level
  ON user_level_unlocks (user_id, level_id)
  WHERE user_id IS NOT NULL;

-- Unique per guest per level
CREATE UNIQUE INDEX IF NOT EXISTS uidx_unlock_guest_level
  ON user_level_unlocks (guest_id, level_id)
  WHERE guest_id IS NOT NULL;

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_unlock_user_id
  ON user_level_unlocks (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unlock_guest_id
  ON user_level_unlocks (guest_id)
  WHERE guest_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. RLS — users can only see their own unlock rows
-- Edge functions use the service-role client and bypass RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE user_level_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_unlocks" ON user_level_unlocks
  FOR SELECT
  USING (auth.uid() = user_id);
