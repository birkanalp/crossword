-- =============================================================================
-- Migration: 025_fix_sort_order_approved_only
-- Description: Re-assign sort_order based only on approved levels.
--   - Pending / rejected levels get sort_order = 0 (no number)
--   - Approved levels are numbered 1, 2, 3... per difficulty, by created_at
--   - Unique index updated to only enforce uniqueness on approved+active levels
-- Date: 2026-03-16
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop existing unique index first (so updates don't violate it)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS uidx_levels_difficulty_sort_order;

-- ---------------------------------------------------------------------------
-- 2. Reset sort_order for non-approved / deleted levels
-- ---------------------------------------------------------------------------
UPDATE levels
SET sort_order = 0
WHERE review_status != 'approved' OR deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Re-backfill approved levels: sequential per difficulty, ordered by created_at
-- ---------------------------------------------------------------------------
UPDATE levels
SET sort_order = sub.rn
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY target_difficulty
      ORDER BY created_at ASC
    ) AS rn
  FROM levels
  WHERE review_status = 'approved'
    AND deleted_at IS NULL
) sub
WHERE levels.id = sub.id;

-- ---------------------------------------------------------------------------
-- 4. Re-create unique index — only enforce uniqueness on approved+active rows
--    with a real sort_order (> 0), so multiple pending levels can coexist at 0
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX uidx_levels_difficulty_sort_order
  ON levels (target_difficulty, sort_order)
  WHERE deleted_at IS NULL
    AND review_status = 'approved'
    AND sort_order > 0;
