-- =============================================================================
-- Migration: 010_levels_playability_backfill
-- Description: Historical no-op. This migration used to auto-approve generated
--              levels and create minimum playable content for local testing.
--              Production deploys must never generate or approve puzzle data as
--              part of schema migration; content is imported/generated explicitly
--              after the word corpus is prepared.
-- Date: 2026-02-25
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[010] Skipped historical playability backfill; production content generation is explicit.';
END $$;
