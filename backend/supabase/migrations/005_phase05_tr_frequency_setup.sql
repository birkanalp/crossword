-- =============================================================================
-- Migration: 005_phase05_tr_frequency_setup
-- Description: Ensure words frequency/tag columns exist and enforce Phase-0.5 TR defaults.
-- Date: 2026-02-24
-- =============================================================================

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS freq_score NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS tags JSONB;

UPDATE words
SET tags = '{}'::jsonb
WHERE tags IS NULL;

ALTER TABLE words
  ALTER COLUMN tags SET DEFAULT '{}'::jsonb,
  ALTER COLUMN tags SET NOT NULL;

ALTER TABLE words
  DROP CONSTRAINT IF EXISTS words_freq_score_chk;

ALTER TABLE words
  ADD CONSTRAINT words_freq_score_chk
  CHECK (freq_score IS NULL OR (freq_score >= 0 AND freq_score <= 1));

ALTER TABLE generation_jobs
  ALTER COLUMN language SET DEFAULT 'tr';

CREATE INDEX IF NOT EXISTS idx_words_language_freq_score
  ON words(language, freq_score DESC NULLS LAST);
