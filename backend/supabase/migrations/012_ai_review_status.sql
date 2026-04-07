-- Extend enum
ALTER TYPE level_review_status ADD VALUE IF NOT EXISTS 'ai_review' BEFORE 'pending';

-- New columns
ALTER TABLE levels
  ADD COLUMN IF NOT EXISTS ai_review_notes  TEXT,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_review_score  INT;

ALTER TABLE levels
  ADD CONSTRAINT levels_ai_review_score_chk
  CHECK (ai_review_score IS NULL OR (ai_review_score BETWEEN 0 AND 100));

-- Relax existing review_notes constraint to allow AI rejections
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'levels'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%review_notes%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE levels DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE levels
  ADD CONSTRAINT levels_review_rejected_requires_notes_chk
  CHECK (
    review_status != 'rejected'
    OR btrim(coalesce(review_notes, '')) <> ''
    OR (reviewed_by IS NULL AND btrim(coalesce(ai_review_notes, '')) <> '')
  );

CREATE INDEX IF NOT EXISTS idx_levels_ai_review_status
  ON levels(review_status, created_at DESC)
  WHERE deleted_at IS NULL;
