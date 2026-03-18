-- =============================================================================
-- Migration 026: Rename "clue" key → "question" in clues_json JSONB
-- =============================================================================
-- Each clue entry in levels.clues_json looks like:
--   { "number": 1, "clue": "...", "answer": "...", "answer_length": 4, "start": {...} }
-- We rename the "clue" key to "question" in every entry across both "across" and "down" arrays.
-- The "hint" key (if present) is preserved unchanged.
-- =============================================================================

UPDATE levels
SET clues_json = jsonb_build_object(
  'across', (
    SELECT jsonb_agg(
      entry - 'clue' || jsonb_build_object('question', entry->>'clue')
    )
    FROM jsonb_array_elements(clues_json->'across') AS entry
  ),
  'down', (
    SELECT jsonb_agg(
      entry - 'clue' || jsonb_build_object('question', entry->>'clue')
    )
    FROM jsonb_array_elements(clues_json->'down') AS entry
  )
)
WHERE deleted_at IS NULL
  AND clues_json IS NOT NULL;
