-- =============================================================================
-- Migration: 010_levels_playability_backfill
-- Description: Temporary playability backfill for levels page stability.
--              1) Normalize auto-generated pending levels to approved.
--              2) Ensure at least 2 approved TR levels per difficulty.
-- Date: 2026-02-25
-- =============================================================================

-- Step 1: Temporary normalization requested by product/ops.
UPDATE levels
SET
  review_status = 'approved'::level_review_status,
  review_notes = COALESCE(NULLIF(review_notes, ''), 'Temporarily auto-approved for playability backfill'),
  reviewed_at = COALESCE(reviewed_at, now()),
  updated_at = now()
WHERE deleted_at IS NULL
  AND auto_generated = TRUE
  AND review_status = 'pending'::level_review_status;

-- Step 2: Backfill missing approved content per difficulty.
DO $$
DECLARE
  v_difficulty difficulty_level;
  v_approved_count INT;
  v_attempts INT;
  v_status TEXT;
  v_message TEXT;
BEGIN
  FOREACH v_difficulty IN ARRAY ARRAY['easy', 'medium', 'hard', 'expert']::difficulty_level[] LOOP
    SELECT COUNT(*)
    INTO v_approved_count
    FROM levels
    WHERE deleted_at IS NULL
      AND language = 'tr'
      AND target_difficulty = v_difficulty
      AND review_status = 'approved'::level_review_status;

    v_attempts := 0;

    WHILE v_approved_count < 2 AND v_attempts < 20 LOOP
      v_attempts := v_attempts + 1;

      SELECT status, message
      INTO v_status, v_message
      FROM run_generation_job_once('tr', v_difficulty, 'phase05-min2-backfill-v1')
      LIMIT 1;

      -- Stop retrying this bucket if generator fails (e.g., not enough eligible words).
      IF v_status IS DISTINCT FROM 'succeeded' THEN
        RAISE NOTICE '[010] Backfill halted for % after attempt %: %', v_difficulty, v_attempts, COALESCE(v_message, 'unknown failure');
        EXIT;
      END IF;

      SELECT COUNT(*)
      INTO v_approved_count
      FROM levels
      WHERE deleted_at IS NULL
        AND language = 'tr'
        AND target_difficulty = v_difficulty
        AND review_status = 'approved'::level_review_status;
    END LOOP;

    RAISE NOTICE '[010] Difficulty % approved_count=% attempts=%', v_difficulty, v_approved_count, v_attempts;
  END LOOP;
END $$;
