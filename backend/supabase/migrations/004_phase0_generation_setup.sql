-- =============================================================================
-- Migration: 004_phase0_generation_setup
-- Description: Phase-0 generation tables, levels extensions, RLS updates, seeds, and one-shot generator.
-- Date: 2026-02-24
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum extensions / additions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TYPE difficulty_level ADD VALUE IF NOT EXISTS 'expert';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'level_review_status') THEN
    CREATE TYPE level_review_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'word_direction') THEN
    CREATE TYPE word_direction AS ENUM ('across', 'down');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- New generation tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS words (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language     TEXT NOT NULL CHECK (language IN ('tr', 'en')),
  word         TEXT NOT NULL,
  length       INT NOT NULL CHECK (length >= 1 AND length <= 20),
  difficulty   difficulty_level NOT NULL,
  freq_score   NUMERIC(4,3) CHECK (freq_score IS NULL OR (freq_score >= 0 AND freq_score <= 1)),
  tags         JSONB NOT NULL DEFAULT '{}'::jsonb,
  definition   TEXT,
  clue_source  TEXT CHECK (clue_source IS NULL OR clue_source IN ('definition', 'wiktionary', 'llm', 'manual')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT words_unique_language_word UNIQUE (language, word)
);

CREATE TABLE IF NOT EXISTS word_usage (
  word_id         UUID PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  used_count      INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  last_used_at    TIMESTAMPTZ,
  cooldown_until  TIMESTAMPTZ,
  locked          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS level_words (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id     UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  word_id      UUID NOT NULL REFERENCES words(id) ON DELETE RESTRICT,
  direction    word_direction NOT NULL,
  start_x      INT NOT NULL CHECK (start_x >= 0),
  start_y      INT NOT NULL CHECK (start_y >= 0),
  length       INT NOT NULL CHECK (length >= 1),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT level_words_unique_level_word UNIQUE (level_id, word_id)
);

CREATE TABLE IF NOT EXISTS difficulty_profiles (
  name               difficulty_level PRIMARY KEY,
  ratios             JSONB NOT NULL,
  grid_min           INT NOT NULL CHECK (grid_min >= 8),
  grid_max           INT NOT NULL CHECK (grid_max <= 15 AND grid_max >= grid_min),
  min_words          INT NOT NULL CHECK (min_words > 0),
  max_words          INT NOT NULL CHECK (max_words >= min_words),
  cooldown_days      INT NOT NULL CHECK (cooldown_days >= 0),
  quality_threshold  INT NOT NULL CHECK (quality_threshold BETWEEN 0 AND 100),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language           TEXT NOT NULL CHECK (language IN ('tr', 'en')),
  target_difficulty  difficulty_level NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempts           INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Extend levels with Phase-0 columns
-- ---------------------------------------------------------------------------
ALTER TABLE levels
  ADD COLUMN IF NOT EXISTS review_status level_review_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generator_version TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'tr',
  ADD COLUMN IF NOT EXISTS target_difficulty difficulty_level,
  ADD COLUMN IF NOT EXISTS computed_difficulty_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS grid_size INT,
  ADD COLUMN IF NOT EXISTS word_count INT,
  ADD COLUMN IF NOT EXISTS words_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS quality_score INT,
  ADD COLUMN IF NOT EXISTS solution_hash TEXT,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE;

UPDATE levels
SET
  review_status = COALESCE(review_status, 'approved'::level_review_status),
  language = COALESCE(language, 'tr'),
  target_difficulty = COALESCE(target_difficulty, difficulty),
  computed_difficulty_score = COALESCE(computed_difficulty_score, CASE difficulty WHEN 'easy' THEN 25 WHEN 'medium' THEN 50 WHEN 'hard' THEN 75 WHEN 'expert' THEN 100 END),
  grid_size = COALESCE(grid_size, NULLIF((grid_json->>'rows')::INT, 0), 8),
  word_count = COALESCE(word_count, GREATEST(2, COALESCE(jsonb_array_length(clues_json->'across'), 0) + COALESCE(jsonb_array_length(clues_json->'down'), 0))),
  words_breakdown = COALESCE(words_breakdown, jsonb_build_object('easy', 0, 'medium', 0, 'hard', 0, 'expert', 0)),
  quality_score = COALESCE(quality_score, 50),
  solution_hash = COALESCE(solution_hash, answer_hash),
  auto_generated = COALESCE(auto_generated, FALSE)
WHERE
  review_status IS NULL
  OR language IS NULL
  OR target_difficulty IS NULL
  OR computed_difficulty_score IS NULL
  OR grid_size IS NULL
  OR word_count IS NULL
  OR words_breakdown IS NULL
  OR quality_score IS NULL
  OR solution_hash IS NULL
  OR auto_generated IS NULL;

ALTER TABLE levels
  ALTER COLUMN review_status SET DEFAULT 'pending',
  ALTER COLUMN review_status SET NOT NULL,
  ALTER COLUMN language SET NOT NULL,
  ALTER COLUMN target_difficulty SET NOT NULL,
  ALTER COLUMN computed_difficulty_score SET NOT NULL,
  ALTER COLUMN grid_size SET NOT NULL,
  ALTER COLUMN word_count SET NOT NULL,
  ALTER COLUMN words_breakdown SET NOT NULL,
  ALTER COLUMN quality_score SET NOT NULL,
  ALTER COLUMN solution_hash SET NOT NULL,
  ALTER COLUMN auto_generated SET NOT NULL;

ALTER TABLE levels
  DROP CONSTRAINT IF EXISTS levels_language_chk;

ALTER TABLE levels
  ADD CONSTRAINT levels_language_chk CHECK (language IN ('tr', 'en'));

ALTER TABLE levels
  DROP CONSTRAINT IF EXISTS levels_difficulty_score_chk;

ALTER TABLE levels
  ADD CONSTRAINT levels_difficulty_score_chk CHECK (computed_difficulty_score BETWEEN 0 AND 100);

ALTER TABLE levels
  DROP CONSTRAINT IF EXISTS levels_quality_score_chk;

ALTER TABLE levels
  ADD CONSTRAINT levels_quality_score_chk CHECK (quality_score BETWEEN 0 AND 100);

ALTER TABLE levels
  DROP CONSTRAINT IF EXISTS levels_word_count_chk;

ALTER TABLE levels
  ADD CONSTRAINT levels_word_count_chk CHECK (word_count >= 0);

ALTER TABLE levels
  DROP CONSTRAINT IF EXISTS levels_review_rejected_requires_notes_chk;

ALTER TABLE levels
  ADD CONSTRAINT levels_review_rejected_requires_notes_chk
  CHECK (review_status != 'rejected' OR btrim(coalesce(review_notes,'')) <> '');

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_created_at
  ON generation_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_updated_at
  ON generation_jobs(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_levels_review_status_language_target_difficulty
  ON levels(review_status, language, target_difficulty)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_words_language_difficulty_length
  ON words(language, difficulty, length);

CREATE INDEX IF NOT EXISTS idx_word_usage_cooldown_locked
  ON word_usage(locked, cooldown_until, used_count, last_used_at);

CREATE INDEX IF NOT EXISTS idx_level_words_level_id
  ON level_words(level_id);

CREATE INDEX IF NOT EXISTS idx_level_words_word_id
  ON level_words(word_id);

-- ---------------------------------------------------------------------------
-- Updated-at triggers for mutable new tables
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_words_updated_at ON words;
CREATE TRIGGER trg_words_updated_at
  BEFORE UPDATE ON words
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_word_usage_updated_at ON word_usage;
CREATE TRIGGER trg_word_usage_updated_at
  BEFORE UPDATE ON word_usage
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_difficulty_profiles_updated_at ON difficulty_profiles;
CREATE TRIGGER trg_difficulty_profiles_updated_at
  BEFORE UPDATE ON difficulty_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_generation_jobs_updated_at ON generation_jobs;
CREATE TRIGGER trg_generation_jobs_updated_at
  BEFORE UPDATE ON generation_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS updates for levels review workflow
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "levels: anyone can read non-premium active levels" ON levels;
DROP POLICY IF EXISTS "levels: read approved levels" ON levels;
DROP POLICY IF EXISTS "levels: admin read all review states" ON levels;
DROP POLICY IF EXISTS "levels: admin update review fields" ON levels;

CREATE OR REPLACE FUNCTION fn_levels_admin_review_update_only(p_new levels)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_old levels%ROWTYPE;
BEGIN
  SELECT *
  INTO v_old
  FROM levels
  WHERE id = p_new.id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN (
    (to_jsonb(p_new) - ARRAY['review_status', 'review_notes', 'reviewed_by', 'reviewed_at', 'updated_at']) =
    (to_jsonb(v_old) - ARRAY['review_status', 'review_notes', 'reviewed_by', 'reviewed_at', 'updated_at'])
  );
END;
$$;

CREATE POLICY "levels: read approved levels"
  ON levels FOR SELECT
  USING (
    deleted_at IS NULL
    AND review_status = 'approved'
    AND (
      is_premium = FALSE
      OR EXISTS (
        SELECT 1
        FROM entitlements e
        WHERE e.user_id = auth.uid()
          AND e.is_pro = TRUE
          AND (e.expires_at IS NULL OR e.expires_at > now())
      )
    )
  );

CREATE POLICY "levels: admin read all review states"
  ON levels FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

CREATE POLICY "levels: admin update review fields"
  ON levels FOR UPDATE TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    AND fn_levels_admin_review_update_only(levels)
  );

-- ---------------------------------------------------------------------------
-- Seed difficulty profiles
-- ---------------------------------------------------------------------------
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
  ('easy',   '{"easy":0.70,"medium":0.25,"hard":0.05,"expert":0.00}'::jsonb, 8, 10, 8, 12, 30, 60),
  ('medium', '{"easy":0.40,"medium":0.45,"hard":0.15,"expert":0.00}'::jsonb, 9, 12, 10, 15, 30, 70),
  ('hard',   '{"easy":0.15,"medium":0.45,"hard":0.30,"expert":0.10}'::jsonb, 10, 14, 12, 18, 30, 78),
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

-- ---------------------------------------------------------------------------
-- Generator skeleton: one job per run in a single DB transaction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION run_generation_job_once(
  p_language TEXT DEFAULT NULL,
  p_target_difficulty difficulty_level DEFAULT NULL,
  p_generator_version TEXT DEFAULT 'phase0-skeleton-v1'
)
RETURNS TABLE (
  job_id UUID,
  level_id UUID,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job generation_jobs%ROWTYPE;
  v_profile difficulty_profiles%ROWTYPE;
  v_level_id UUID := gen_random_uuid();
  v_grid_size INT;
  v_target_words INT;
  v_selected_ids UUID[];
  v_selected_count INT;
  v_words_breakdown JSONB;
  v_computed_score NUMERIC(5,2);
  v_quality_score INT;
  v_solution_hash TEXT;
  v_word_a TEXT;
  v_word_b TEXT;
  v_len_a INT;
  v_len_b INT;
  v_err TEXT;
BEGIN
  SELECT gj.*
  INTO v_job
  FROM generation_jobs gj
  WHERE gj.status = 'queued'
    AND (p_language IS NULL OR gj.language = p_language)
    AND (p_target_difficulty IS NULL OR gj.target_difficulty = p_target_difficulty)
  ORDER BY gj.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO generation_jobs(language, target_difficulty, status, attempts, last_error)
    VALUES (
      COALESCE(p_language, (ARRAY['tr', 'en'])[((SELECT COUNT(*) FROM generation_jobs) % 2) + 1]),
      COALESCE(p_target_difficulty, (ARRAY['easy', 'medium', 'hard', 'expert']::difficulty_level[])[((SELECT COUNT(*) FROM generation_jobs) % 4) + 1]),
      'queued',
      0,
      NULL
    )
    RETURNING * INTO v_job;
  END IF;

  UPDATE generation_jobs
  SET status = 'running', attempts = attempts + 1, last_error = NULL, updated_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  SELECT *
  INTO v_profile
  FROM difficulty_profiles
  WHERE name = v_job.target_difficulty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Missing difficulty_profile for %', v_job.target_difficulty;
  END IF;

  v_grid_size := v_profile.grid_min;
  v_target_words := v_profile.min_words;

  WITH desired AS (
    SELECT
      GREATEST(0, FLOOR((v_profile.ratios->>'easy')::numeric * v_target_words))::INT AS easy_cnt,
      GREATEST(0, FLOOR((v_profile.ratios->>'medium')::numeric * v_target_words))::INT AS medium_cnt,
      GREATEST(0, FLOOR((v_profile.ratios->>'hard')::numeric * v_target_words))::INT AS hard_cnt,
      GREATEST(0, FLOOR((v_profile.ratios->>'expert')::numeric * v_target_words))::INT AS expert_cnt
  ),
  eligible AS (
    SELECT
      w.id,
      w.difficulty,
      w.word,
      w.length,
      COALESCE(wu.used_count, 0) AS used_count,
      wu.last_used_at
    FROM words w
    LEFT JOIN word_usage wu ON wu.word_id = w.id
    WHERE w.language = v_job.language
      AND w.length <= v_profile.grid_max
      AND COALESCE(wu.locked, FALSE) = FALSE
      AND (wu.cooldown_until IS NULL OR wu.cooldown_until <= now())
  ),
  picked AS (
    SELECT e.id
    FROM eligible e, desired d
    WHERE e.difficulty = 'easy'
    ORDER BY e.used_count ASC, e.last_used_at ASC NULLS FIRST, random()
    LIMIT (SELECT easy_cnt FROM desired)
  ),
  picked2 AS (
    SELECT e.id
    FROM eligible e, desired d
    WHERE e.difficulty = 'medium'
      AND e.id NOT IN (SELECT id FROM picked)
    ORDER BY e.used_count ASC, e.last_used_at ASC NULLS FIRST, random()
    LIMIT (SELECT medium_cnt FROM desired)
  ),
  picked3 AS (
    SELECT e.id
    FROM eligible e, desired d
    WHERE e.difficulty = 'hard'
      AND e.id NOT IN (SELECT id FROM picked UNION SELECT id FROM picked2)
    ORDER BY e.used_count ASC, e.last_used_at ASC NULLS FIRST, random()
    LIMIT (SELECT hard_cnt FROM desired)
  ),
  picked4 AS (
    SELECT e.id
    FROM eligible e, desired d
    WHERE e.difficulty = 'expert'
      AND e.id NOT IN (SELECT id FROM picked UNION SELECT id FROM picked2 UNION SELECT id FROM picked3)
    ORDER BY e.used_count ASC, e.last_used_at ASC NULLS FIRST, random()
    LIMIT (SELECT expert_cnt FROM desired)
  ),
  combined AS (
    SELECT id FROM picked
    UNION
    SELECT id FROM picked2
    UNION
    SELECT id FROM picked3
    UNION
    SELECT id FROM picked4
  ),
  topped_up AS (
    SELECT e.id
    FROM eligible e
    WHERE e.id NOT IN (SELECT id FROM combined)
    ORDER BY e.used_count ASC, e.last_used_at ASC NULLS FIRST, random()
    LIMIT GREATEST(0, v_target_words - (SELECT COUNT(*) FROM combined))
  ),
  final_ids AS (
    SELECT id FROM combined
    UNION
    SELECT id FROM topped_up
  )
  SELECT ARRAY_AGG(id)
  INTO v_selected_ids
  FROM final_ids;

  v_selected_count := COALESCE(array_length(v_selected_ids, 1), 0);
  IF v_selected_count < 2 THEN
    RAISE EXCEPTION 'Not enough eligible words for language=% and difficulty=%', v_job.language, v_job.target_difficulty;
  END IF;

  SELECT
    jsonb_build_object(
      'easy', COUNT(*) FILTER (WHERE difficulty = 'easy'),
      'medium', COUNT(*) FILTER (WHERE difficulty = 'medium'),
      'hard', COUNT(*) FILTER (WHERE difficulty = 'hard'),
      'expert', COUNT(*) FILTER (WHERE difficulty = 'expert')
    ),
    ROUND(AVG(
      CASE difficulty
        WHEN 'easy' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'hard' THEN 3
        WHEN 'expert' THEN 4
      END
    ) * 25.0, 2),
    encode(digest(string_agg(word, '|' ORDER BY id), 'sha256'), 'hex')
  INTO v_words_breakdown, v_computed_score, v_solution_hash
  FROM words
  WHERE id = ANY(v_selected_ids);

  v_quality_score := LEAST(100, GREATEST(v_profile.quality_threshold, v_profile.quality_threshold + (v_selected_count - v_profile.min_words)));

  SELECT word, length INTO v_word_a, v_len_a
  FROM words
  WHERE id = v_selected_ids[1];

  SELECT word, length INTO v_word_b, v_len_b
  FROM words
  WHERE id = v_selected_ids[2];

  -- Single persistence unit: level + level_words + word_usage + generation_job status.
  INSERT INTO levels (
    id,
    version,
    difficulty,
    target_difficulty,
    computed_difficulty_score,
    language,
    grid_size,
    word_count,
    words_breakdown,
    quality_score,
    grid_json,
    clues_json,
    answer_hash,
    solution_hash,
    auto_generated,
    review_status,
    generator_version,
    is_premium,
    difficulty_multiplier
  )
  VALUES (
    v_level_id,
    1,
    v_job.target_difficulty,
    v_job.target_difficulty,
    v_computed_score,
    v_job.language,
    v_grid_size,
    v_selected_count,
    v_words_breakdown,
    v_quality_score,
    jsonb_build_object(
      'rows', v_grid_size,
      'cols', v_grid_size,
      'cells', (
        SELECT jsonb_agg(
          jsonb_build_object('row', r - 1, 'col', c - 1, 'type', 'letter')
          ORDER BY r, c
        )
        FROM generate_series(1, v_grid_size) AS r
        CROSS JOIN generate_series(1, v_grid_size) AS c
      )
    ),
    jsonb_build_object(
      'across', jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'clue', COALESCE('Auto-generated clue for ' || v_word_a, 'Auto-generated clue'),
          'answer_length', COALESCE(v_len_a, 3),
          'start', jsonb_build_object('row', 0, 'col', 0)
        )
      ),
      'down', jsonb_build_array(
        jsonb_build_object(
          'number', 2,
          'clue', COALESCE('Auto-generated clue for ' || v_word_b, 'Auto-generated clue'),
          'answer_length', COALESCE(v_len_b, 3),
          'start', jsonb_build_object('row', 1, 'col', 0)
        )
      )
    ),
    v_solution_hash,
    v_solution_hash,
    TRUE,
    'pending',
    p_generator_version,
    FALSE,
    CASE v_job.target_difficulty
      WHEN 'easy' THEN 1.0
      WHEN 'medium' THEN 1.5
      WHEN 'hard' THEN 2.0
      WHEN 'expert' THEN 2.5
    END
  );

  INSERT INTO level_words (
    level_id,
    word_id,
    direction,
    start_x,
    start_y,
    length
  )
  SELECT
    v_level_id,
    w.id,
    CASE WHEN (ROW_NUMBER() OVER (ORDER BY w.id)) % 2 = 1 THEN 'across'::word_direction ELSE 'down'::word_direction END,
    ((ROW_NUMBER() OVER (ORDER BY w.id)) - 1) % v_grid_size,
    (((ROW_NUMBER() OVER (ORDER BY w.id)) - 1) / v_grid_size)::INT,
    w.length
  FROM words w
  WHERE w.id = ANY(v_selected_ids);

  INSERT INTO word_usage (
    word_id,
    used_count,
    last_used_at,
    cooldown_until,
    locked
  )
  SELECT
    w.id,
    1,
    now(),
    now() + make_interval(days => v_profile.cooldown_days),
    FALSE
  FROM words w
  WHERE w.id = ANY(v_selected_ids)
  ON CONFLICT (word_id) DO UPDATE
  SET
    used_count = word_usage.used_count + 1,
    last_used_at = EXCLUDED.last_used_at,
    cooldown_until = EXCLUDED.cooldown_until,
    updated_at = now();

  UPDATE generation_jobs
  SET status = 'succeeded', last_error = NULL, updated_at = now()
  WHERE id = v_job.id;

  RETURN QUERY SELECT v_job.id, v_level_id, 'succeeded'::TEXT, 'generated_pending_level'::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_job.id IS NOT NULL THEN
      UPDATE generation_jobs
      SET status = 'failed', last_error = v_err, updated_at = now()
      WHERE id = v_job.id;
      RETURN QUERY SELECT v_job.id, NULL::UUID, 'failed'::TEXT, v_err;
    ELSE
      RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'failed'::TEXT, v_err;
    END IF;
END;
$$;
