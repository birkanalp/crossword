-- =============================================================================
-- Migration: 028_has_viewed
-- Description: Tracks whether any player has ever opened a puzzle.
--   - has_viewed = false → fresh, unplayed content
--   - has_viewed = true  → at least one player opened this level
-- Used by: generation worker to measure unviewed approved stock per difficulty.
-- =============================================================================

ALTER TABLE levels ADD COLUMN IF NOT EXISTS has_viewed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN levels.has_viewed IS
  'Set to true the first time any user fetches this level via getLevel. '
  'Default false for all new and existing levels. '
  'Used for low-stock detection: count approved+unviewed per difficulty.';

-- Partial index: only covers approved, non-deleted rows since those are the
-- only ones the stock query cares about.
CREATE INDEX IF NOT EXISTS idx_levels_unviewed_stock
  ON levels (target_difficulty, has_viewed)
  WHERE review_status = 'approved' AND deleted_at IS NULL;
