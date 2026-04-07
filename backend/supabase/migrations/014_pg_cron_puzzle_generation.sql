-- =============================================================================
-- Migration: 014_pg_cron_puzzle_generation
-- Description: Historical no-op. Production generation now runs through explicit
--              app/worker flows, not DB-level pg_cron migrations.
-- Date: 2026-02-26
--
-- Puzzle generation runs via Docker cron service (scripts/tr/generate-crossword.ts)
-- — same as admin "Yeni Bulmaca" button.
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[014] Skipped pg_cron setup; production cron must be configured explicitly outside migrations.';
END $$;
