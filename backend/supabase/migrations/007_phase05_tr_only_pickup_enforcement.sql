-- =============================================================================
-- Migration: 007_phase05_tr_only_pickup_enforcement
-- Description: Enforce TR-only queued job pickup when p_language is NULL.
-- Date: 2026-02-24
-- =============================================================================

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
    AND (
      (p_language IS NULL AND gj.language = 'tr')
      OR (p_language IS NOT NULL AND gj.language = p_language)
    )
    AND (p_target_difficulty IS NULL OR gj.target_difficulty = p_target_difficulty)
  ORDER BY gj.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO generation_jobs(language, target_difficulty, status, attempts, last_error)
    VALUES (
      COALESCE(p_language, 'tr'),
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
