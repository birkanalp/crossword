-- =============================================================================
-- Migration: 015_remove_pg_cron_puzzle_job
-- Description: Remove pg_cron puzzle job if it was scheduled by old 014.
--              Puzzle generation now runs via Docker cron (generate-crossword.ts).
-- Date: 2026-02-26
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('generate-puzzle-tr');
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
