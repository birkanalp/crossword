-- Migration 021: Review system improvements
-- Adds audit columns for deterministic check failures and raw LLM responses.
-- These columns allow post-hoc debugging of review decisions.

ALTER TABLE levels
  ADD COLUMN IF NOT EXISTS deterministic_failures JSONB,
  ADD COLUMN IF NOT EXISTS llm_raw_response       TEXT,
  ADD COLUMN IF NOT EXISTS llm_clue_scores        JSONB,
  ADD COLUMN IF NOT EXISTS review_rejected_by     TEXT;

COMMENT ON COLUMN levels.deterministic_failures IS
  'Array of failure messages from Phase 1 deterministic checks. Empty array means Phase 1 passed.';
COMMENT ON COLUMN levels.llm_raw_response IS
  'Raw response text from Ollama for the last AI review. Used for debugging hallucinations.';
COMMENT ON COLUMN levels.llm_clue_scores IS
  'Per-clue LLM advisory scores: [{dir, number, score}]. Score 0-100 per clue.';
COMMENT ON COLUMN levels.review_rejected_by IS
  'Which phase caused rejection: "deterministic" | "llm" | null (if passed or not yet reviewed).';

-- Optional constraint: review_rejected_by must be one of the allowed values when set
ALTER TABLE levels
  ADD CONSTRAINT levels_review_rejected_by_chk
  CHECK (
    review_rejected_by IS NULL
    OR review_rejected_by IN ('deterministic', 'llm')
  );

-- Index for auditing AI-only rejections (backfill use)
CREATE INDEX IF NOT EXISTS idx_levels_ai_only_rejected
  ON levels(review_status, ai_reviewed_at, reviewed_by)
  WHERE deleted_at IS NULL
    AND review_status = 'rejected'
    AND reviewed_by IS NULL;
