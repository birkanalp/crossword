-- Migration 027: Add 'generating' status to level_review_status enum
--
-- Lifecycle: generating → ai_review → pending → approved
--                                    ↘ rejected
--
-- 'generating' is a placeholder status assigned to levels the moment a batch
-- generation request is received. The placeholder record exists in the DB so
-- the admin kanban board can show generation progress in real time. Once the
-- generation script completes building the puzzle, it UPDATEs the row with
-- full grid/clue data and flips the status to 'ai_review'.

ALTER TYPE level_review_status ADD VALUE IF NOT EXISTS 'generating' BEFORE 'ai_review';
