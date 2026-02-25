-- =============================================================================
-- Migration: 009_checkword_progress_history
-- Description: Persist checkWord validation attempts and retry-safe resume state.
-- Date: 2026-02-25
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_answer_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  guest_id       UUID,
  level_id       UUID        NOT NULL REFERENCES levels (id) ON DELETE RESTRICT,
  request_id     UUID        NOT NULL,
  clue_number    INT         NOT NULL CHECK (clue_number >= 1),
  direction      TEXT        NOT NULL CHECK (direction IN ('across', 'down')),
  submitted_word TEXT        NOT NULL CHECK (length(trim(submitted_word)) > 0),
  is_correct     BOOLEAN     NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_answer_history_owner CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL) OR
    (user_id IS NULL AND guest_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_answer_history_level_created
  ON user_answer_history (level_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_answer_history_user_created
  ON user_answer_history (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_answer_history_guest_created
  ON user_answer_history (guest_id, created_at DESC)
  WHERE guest_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uidx_answer_history_user_request'
  ) THEN
    CREATE UNIQUE INDEX uidx_answer_history_user_request
      ON user_answer_history (user_id, level_id, request_id)
      WHERE user_id IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION record_checkword_progress(
  p_user_id UUID,
  p_guest_id UUID,
  p_level_id UUID,
  p_request_id UUID,
  p_state_json JSONB,
  p_time_spent INT,
  p_hints_used INT,
  p_mistakes INT,
  p_clue_number INT,
  p_direction TEXT,
  p_submitted_word TEXT,
  p_is_correct BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (p_user_id IS NULL AND p_guest_id IS NULL) OR (p_user_id IS NOT NULL AND p_guest_id IS NOT NULL) THEN
    RAISE EXCEPTION 'record_checkword_progress requires exactly one owner (user or guest)';
  END IF;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO user_progress (
      user_id, guest_id, level_id, state_json, completed_at,
      time_spent, hints_used, mistakes, updated_at
    )
    VALUES (
      p_user_id, NULL, p_level_id, COALESCE(p_state_json, '{}'::jsonb), NULL,
      GREATEST(COALESCE(p_time_spent, 0), 0),
      GREATEST(COALESCE(p_hints_used, 0), 0),
      GREATEST(COALESCE(p_mistakes, 0), 0),
      NOW()
    )
    ON CONFLICT (user_id, level_id)
    DO UPDATE SET
      state_json = EXCLUDED.state_json,
      time_spent = EXCLUDED.time_spent,
      hints_used = EXCLUDED.hints_used,
      mistakes = EXCLUDED.mistakes,
      updated_at = NOW()
    WHERE user_progress.completed_at IS NULL;

    INSERT INTO user_answer_history (
      user_id, guest_id, level_id, request_id, clue_number, direction, submitted_word, is_correct
    )
    VALUES (
      p_user_id, NULL, p_level_id, p_request_id, p_clue_number, p_direction, p_submitted_word, p_is_correct
    )
    ON CONFLICT (user_id, level_id, request_id) DO NOTHING;
  ELSE
    INSERT INTO user_progress (
      user_id, guest_id, level_id, state_json, completed_at,
      time_spent, hints_used, mistakes, updated_at
    )
    VALUES (
      NULL, p_guest_id, p_level_id, COALESCE(p_state_json, '{}'::jsonb), NULL,
      GREATEST(COALESCE(p_time_spent, 0), 0),
      GREATEST(COALESCE(p_hints_used, 0), 0),
      GREATEST(COALESCE(p_mistakes, 0), 0),
      NOW()
    )
    ON CONFLICT (guest_id, level_id)
    DO UPDATE SET
      state_json = EXCLUDED.state_json,
      time_spent = EXCLUDED.time_spent,
      hints_used = EXCLUDED.hints_used,
      mistakes = EXCLUDED.mistakes,
      updated_at = NOW()
    WHERE user_progress.completed_at IS NULL;

    INSERT INTO user_answer_history (
      user_id, guest_id, level_id, request_id, clue_number, direction, submitted_word, is_correct
    )
    VALUES (
      NULL, p_guest_id, p_level_id, p_request_id, p_clue_number, p_direction, p_submitted_word, p_is_correct
    )
    ON CONFLICT (guest_id, level_id, request_id) DO NOTHING;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uidx_answer_history_guest_request'
  ) THEN
    CREATE UNIQUE INDEX uidx_answer_history_guest_request
      ON user_answer_history (guest_id, level_id, request_id)
      WHERE guest_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE user_answer_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_answer_history'
      AND policyname = 'answer_history: users read own'
  ) THEN
    CREATE POLICY "answer_history: users read own"
      ON user_answer_history FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
