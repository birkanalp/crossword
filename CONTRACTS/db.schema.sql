-- =============================================================================
-- CONTRACTS/db.schema.sql
-- contractVersion: 1.1.6
-- lastUpdated: 2026-02-25
-- owner: backend-agent
-- consumers: frontend-agent
--
-- PURPOSE
-- This file is a READ-ONLY contract surface, not a migration.
-- It describes ONLY the columns and types that the frontend or other
-- agents may reference (e.g. via Supabase client queries, REST API, or
-- realtime subscriptions). Internal-only columns (e.g. answer_hash) are
-- marked and must never be queried by clients.
--
-- For the full authoritative migration SQL, see:
--   backend/supabase/migrations/001_initial_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CHANGELOG
-- 1.1.6  2026-02-25  Added admin metrics contract notes (daily_plays, users, paid_users, active_users_15min) using existing tables; no new schema required
-- 1.1.5  2026-02-25  Added user_answer_history contract surface for checkWord validation persistence/resume auditing
-- 1.1.4  2026-02-25  Contract sync: clarified levels.clues_json at-rest server-only answer allowance and public response stripping
-- 1.1.3  2026-02-24  Phase-0.5 TR corpus import contract sync: words.freq_score/tags + TR-default generation path
-- 1.1.2  2026-02-24  Phase-0 enum type alignment with migration 004
-- 1.1.1  2026-02-24  Contract sync: added missing Phase-0 migrated columns for generation tables
-- 1.1.0  2026-02-24  Phase-0 generation surfaces added (words, review workflow, generation jobs)
-- 1.0.0  2026-02-21  Phase 1 initial contract
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Shared enum surfaces (contract-level reference)
-- ---------------------------------------------------------------------------
-- difficulty_level: easy | medium | hard | expert
-- level_review_status: pending | approved | rejected

-- ---------------------------------------------------------------------------
-- levels
-- Client-accessible columns (via getLevel Edge Function ONLY — not direct REST)
-- ---------------------------------------------------------------------------
CREATE TABLE levels (
  id                        UUID                NOT NULL,   -- PK
  version                   INT                 NOT NULL,   -- Increment on content change
  difficulty                TEXT                NOT NULL,   -- DEPRECATED: kept for compatibility only; do not rely on it
  target_difficulty         difficulty_level    NOT NULL,   -- Canonical difficulty target
  computed_difficulty_score NUMERIC(5,2)        NOT NULL,   -- Canonical computed score range 0..100
  language                  TEXT                NOT NULL,   -- 'tr' | 'en'
  grid_size                 INT                 NOT NULL,   -- Dynamic in-generator grid size
  word_count                INT                 NOT NULL,
  words_breakdown           JSONB               NOT NULL,   -- Counts by difficulty bucket
  quality_score             INT                 NOT NULL,   -- 0..100
  solution_hash             TEXT                NOT NULL,   -- Generation-side solution integrity hash
  auto_generated            BOOLEAN             NOT NULL,   -- true when produced by generator
  review_status             level_review_status NOT NULL,
  review_notes              TEXT,                           -- Required when review_status='rejected'
  reviewed_by               UUID,                           -- Admin user id
  reviewed_at               TIMESTAMPTZ,
  generator_version         TEXT,                           -- Generator build/version marker
  is_premium                BOOLEAN             NOT NULL,   -- Gated behind Pro entitlement
  grid_json                 JSONB               NOT NULL,   -- See level.schema.json#/definitions/GridJson
  clues_json                JSONB               NOT NULL,   -- See level.schema.json#/definitions/CluesJson; at rest clue entries may include server-only answer, but public API responses strip answer
  difficulty_multiplier     NUMERIC(4,2)        NOT NULL,   -- Used in score formula; read-only for client
  created_at                TIMESTAMPTZ         NOT NULL,
  updated_at                TIMESTAMPTZ         NOT NULL,

  -- INTERNAL — NEVER QUERY FROM CLIENT
  -- answer_hash         TEXT            NOT NULL,  -- SHA-256; backend only
  -- deleted_at          TIMESTAMPTZ                -- Soft delete; backend only
);

-- Canonical selection/scoring fields are:
--   levels.target_difficulty + levels.computed_difficulty_score
-- `levels.difficulty` remains contract-visible for backward compatibility only.

-- ---------------------------------------------------------------------------
-- words
-- Dictionary source table used by generation pipeline.
-- ---------------------------------------------------------------------------
CREATE TABLE words (
  id           UUID            NOT NULL,   -- PK
  language     TEXT            NOT NULL,   -- Phase-0.5 runtime default: 'tr'
  word         TEXT            NOT NULL,   -- unique per language
  length       INT             NOT NULL,   -- max 20
  difficulty   difficulty_level NOT NULL,
  freq_score   NUMERIC(4,3),               -- optional 0..1
  tags         JSONB           NOT NULL,
  definition   TEXT,
  clue_source  TEXT,                       -- definition|wiktionary|llm|manual
  created_at   TIMESTAMPTZ     NOT NULL,
  updated_at   TIMESTAMPTZ     NOT NULL
);

-- ---------------------------------------------------------------------------
-- word_usage
-- Tracks cooldown and usage counters per word.
-- ---------------------------------------------------------------------------
CREATE TABLE word_usage (
  word_id         UUID            NOT NULL,  -- PK/FK -> words.id
  used_count      INT             NOT NULL,
  last_used_at    TIMESTAMPTZ,
  cooldown_until  TIMESTAMPTZ,
  locked          BOOLEAN         NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL,
  updated_at      TIMESTAMPTZ     NOT NULL
);

-- ---------------------------------------------------------------------------
-- level_words
-- Mapping table between generated levels and selected words.
-- ---------------------------------------------------------------------------
CREATE TABLE level_words (
  id          UUID            NOT NULL,   -- PK
  level_id    UUID            NOT NULL,   -- FK -> levels.id
  word_id     UUID            NOT NULL,   -- FK -> words.id
  direction   word_direction  NOT NULL,
  start_x     INT             NOT NULL,
  start_y     INT             NOT NULL,
  length      INT             NOT NULL,
  created_at  TIMESTAMPTZ     NOT NULL
);

-- ---------------------------------------------------------------------------
-- difficulty_profiles
-- Generator profile config per target difficulty.
-- ---------------------------------------------------------------------------
CREATE TABLE difficulty_profiles (
  name               difficulty_level NOT NULL,
  ratios             JSONB           NOT NULL,   -- {easy,medium,hard,expert}
  grid_min           INT             NOT NULL,
  grid_max           INT             NOT NULL,
  min_words          INT             NOT NULL,
  max_words          INT             NOT NULL,
  cooldown_days      INT             NOT NULL,
  quality_threshold  INT             NOT NULL,
  created_at         TIMESTAMPTZ     NOT NULL,
  updated_at         TIMESTAMPTZ     NOT NULL
);

-- ---------------------------------------------------------------------------
-- generation_jobs
-- Queue + status table for one-job-per-run generation loop.
-- ---------------------------------------------------------------------------
CREATE TABLE generation_jobs (
  id                 UUID            NOT NULL,   -- PK
  language           TEXT            NOT NULL,   -- Phase-0.5 runtime default: tr
  target_difficulty  difficulty_level NOT NULL,
  status             TEXT            NOT NULL,   -- queued|running|succeeded|failed
  attempts           INT             NOT NULL,
  last_error         TEXT,
  created_at         TIMESTAMPTZ     NOT NULL,
  updated_at         TIMESTAMPTZ     NOT NULL
);

-- ---------------------------------------------------------------------------
-- user_progress
-- Readable by authenticated user for their own rows (RLS enforced).
-- Guests access via Edge Functions only.
-- ---------------------------------------------------------------------------
CREATE TABLE user_progress (
  id           UUID        NOT NULL,   -- PK
  user_id      UUID,                   -- NULL if guest; FK → auth.users
  guest_id     UUID,                   -- NULL if authenticated
  level_id     UUID        NOT NULL,   -- FK → levels.id
  state_json   JSONB       NOT NULL,   -- Opaque client state; backend stores verbatim
  completed_at TIMESTAMPTZ,            -- NULL = in progress
  time_spent   INT         NOT NULL,   -- Seconds
  mistakes     INT         NOT NULL,
  hints_used   INT         NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- user_answer_history
-- Per-attempt audit log for checkWord validation flow. Rows are append-only and
-- retry-safe through request_id uniqueness (per owner + level).
-- Operational surface (migration 009):
--   indexes: idx_answer_history_level_created, idx_answer_history_user_created,
--            idx_answer_history_guest_created, uidx_answer_history_user_request,
--            uidx_answer_history_guest_request
--   rpc: record_checkword_progress(level_id uuid, request_id uuid, clue_number int,
--        direction text, submitted_word text, is_correct boolean, state_json jsonb,
--        time_spent int, hints_used int, mistakes int)
--   rls: answer_history: users read own
-- ---------------------------------------------------------------------------
CREATE TABLE user_answer_history (
  id             UUID        NOT NULL,   -- PK
  user_id        UUID,                   -- NULL if guest
  guest_id       UUID,                   -- NULL if authenticated
  level_id       UUID        NOT NULL,   -- FK -> levels.id
  request_id     UUID        NOT NULL,   -- Idempotency key
  clue_number    INT         NOT NULL,
  direction      TEXT        NOT NULL,   -- across | down
  submitted_word TEXT        NOT NULL,
  is_correct     BOOLEAN     NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- daily_challenges
-- Publicly readable. Used to display today's special puzzle.
-- ---------------------------------------------------------------------------
CREATE TABLE daily_challenges (
  id                  UUID    NOT NULL,  -- PK
  date                DATE    NOT NULL,  -- UNIQUE; one challenge per calendar day
  level_id            UUID    NOT NULL,  -- FK → levels.id
  leaderboard_enabled BOOLEAN NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- leaderboard_entries
-- Publicly readable. One entry per (user, level).
-- Writes are via submitScore Edge Function only.
-- ---------------------------------------------------------------------------
CREATE TABLE leaderboard_entries (
  id              UUID        NOT NULL,  -- PK
  user_id         UUID        NOT NULL,  -- FK → auth.users
  level_id        UUID        NOT NULL,  -- FK → levels.id
  score           INT         NOT NULL,  -- Server-computed; authoritative
  completion_time INT         NOT NULL,  -- Seconds
  hints_used      INT         NOT NULL,
  mistakes        INT         NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- entitlements
-- Readable by authenticated user for their own row.
-- Writes are via RevenueCat webhook only.
-- ---------------------------------------------------------------------------
CREATE TABLE entitlements (
  id         UUID        NOT NULL,   -- PK
  user_id    UUID        NOT NULL,   -- UNIQUE; FK → auth.users
  is_pro     BOOLEAN     NOT NULL,   -- Main gate: true = active Pro subscription
  source     TEXT,                   -- 'app_store' | 'play_store' | 'promotional'
  expires_at TIMESTAMPTZ,            -- NULL = lifetime. Check this before trusting is_pro.
  updated_at TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- streaks
-- Readable by authenticated user for their own row.
-- ---------------------------------------------------------------------------
CREATE TABLE streaks (
  id                  UUID  NOT NULL,  -- PK
  user_id             UUID  NOT NULL,  -- UNIQUE; FK → auth.users
  current_streak      INT   NOT NULL,  -- Days
  longest_streak      INT   NOT NULL,
  last_completed_date DATE,            -- NULL = no completions yet
  updated_at          TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- coins
-- Readable by authenticated user for their own row.
-- ---------------------------------------------------------------------------
CREATE TABLE coins (
  id         UUID  NOT NULL,   -- PK
  user_id    UUID  NOT NULL,   -- UNIQUE; FK → auth.users
  balance    INT   NOT NULL,   -- Current balance; always >= 0
  updated_at TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- coin_transactions
-- Readable by authenticated user for their own rows. Append-only.
-- ---------------------------------------------------------------------------
CREATE TABLE coin_transactions (
  id         UUID        NOT NULL,   -- PK
  user_id    UUID        NOT NULL,   -- FK → auth.users
  amount     INT         NOT NULL,   -- Positive = earn, negative = spend
  type       TEXT        NOT NULL,   -- 'earn' | 'spend' | 'refund' | 'bonus'
  metadata   JSONB       NOT NULL,   -- { source, level_id, ... }
  created_at TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- admin_metrics (contract notes)
-- No additional tracking table is required for Phase 3 Step 1 contracts.
-- Admin dashboard metrics are computed from existing surfaces:
--   - daily_plays:            count(leaderboard_entries.*) for current date
--   - total_users:            count(auth.users.*) or mirrored profile user surface
--   - paid_users:             count(entitlements.* where is_pro = true and
--                             (expires_at is null or expires_at > now()))
--   - active_users_15min:     distinct union of:
--                               user_progress.user_id where updated_at >= now() - interval '15 min'
--                               leaderboard_entries.user_id where created_at >= now() - interval '15 min'
-- Daily series endpoint source:
--   - plays/day:              leaderboard_entries.created_at::date aggregation
--   - completions/day:        user_progress.completed_at::date aggregation
-- Notes:
--   - user_progress guest rows (guest_id) are excluded from active_users_15min.
--   - Distinctness is by authenticated user_id.
-- ---------------------------------------------------------------------------
