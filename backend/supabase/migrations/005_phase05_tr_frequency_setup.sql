-- =============================================================================
-- Migration: 005_phase05_tr_frequency_setup
-- Description: Ensure words frequency/tag columns exist and enforce Phase-0.5 TR defaults.
-- Date: 2026-02-24
-- =============================================================================

-- Expert was added to difficulty_level in 004. Insert the profile in a separate
-- migration transaction before later generator patches can create expert jobs.
INSERT INTO difficulty_profiles (
  name,
  ratios,
  grid_min,
  grid_max,
  min_words,
  max_words,
  cooldown_days,
  quality_threshold
)
VALUES
  ('expert', '{"easy":0.05,"medium":0.25,"hard":0.45,"expert":0.25}'::jsonb, 11, 15, 14, 22, 21, 85)
ON CONFLICT (name) DO UPDATE SET
  ratios = EXCLUDED.ratios,
  grid_min = EXCLUDED.grid_min,
  grid_max = EXCLUDED.grid_max,
  min_words = EXCLUDED.min_words,
  max_words = EXCLUDED.max_words,
  cooldown_days = EXCLUDED.cooldown_days,
  quality_threshold = EXCLUDED.quality_threshold,
  updated_at = now();

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
