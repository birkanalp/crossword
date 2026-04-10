-- =============================================================================
-- Migration 029: OpenAI review pipeline columns
-- Adds per-clue rich review data and puzzle-level review flags.
-- Preserves existing llm_clue_scores (kept for audit compatibility).
-- =============================================================================

ALTER TABLE levels
  ADD COLUMN IF NOT EXISTS llm_clue_reviews   JSONB,
  ADD COLUMN IF NOT EXISTS needs_human_review  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auto_fix_count   INT;

COMMENT ON COLUMN levels.llm_clue_reviews IS
  'Per-clue rich review from OpenAI: [{clueId, status, issueCodes, confidence, fixedClue, score, hintEligible}]. '
  'Populated after review pass. Supersedes llm_clue_scores for new data.';

COMMENT ON COLUMN levels.needs_human_review IS
  'true when puzzleScore < 80, autoFixCount > maxAutoFixes, or any clue is needs_human_review status.';

COMMENT ON COLUMN levels.ai_auto_fix_count IS
  'Number of clues where AI suggested and applied a small fix in the last review run.';

-- Fast admin query for puzzles needing human review
CREATE INDEX IF NOT EXISTS idx_levels_needs_human_review
  ON levels(needs_human_review, ai_reviewed_at DESC)
  WHERE deleted_at IS NULL AND needs_human_review = true;
