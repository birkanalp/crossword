-- =============================================================================
-- Migration: 014_pg_cron_puzzle_generation
-- Description: Enable pg_cron extension (optional, for future DB-level cron jobs).
-- Date: 2026-02-26
--
-- Puzzle generation runs via Docker cron service (scripts/tr/generate-crossword.ts)
-- — same as admin "Yeni Bulmaca" button. pg_cron kept for potential future use.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;
