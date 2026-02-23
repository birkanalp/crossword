-- =============================================================================
-- CONTRACTS/db.schema.sql
-- contractVersion: 1.0.0
-- lastUpdated: 2026-02-21
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
-- 1.0.0  2026-02-21  Phase 1 initial contract
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- levels
-- Client-accessible columns (via getLevel Edge Function ONLY — not direct REST)
-- ---------------------------------------------------------------------------
CREATE TABLE levels (
  id                    UUID            NOT NULL,   -- PK
  version               INT             NOT NULL,   -- Increment on content change
  difficulty            TEXT            NOT NULL,   -- 'easy' | 'medium' | 'hard'
  is_premium            BOOLEAN         NOT NULL,   -- Gated behind Pro entitlement
  grid_json             JSONB           NOT NULL,   -- See level.schema.json#/definitions/GridJson
  clues_json            JSONB           NOT NULL,   -- See level.schema.json#/definitions/CluesJson
  difficulty_multiplier NUMERIC(4,2)    NOT NULL,   -- Used in score formula; read-only for client
  created_at            TIMESTAMPTZ     NOT NULL,
  updated_at            TIMESTAMPTZ     NOT NULL,

  -- INTERNAL — NEVER QUERY FROM CLIENT
  -- answer_hash         TEXT            NOT NULL,  -- SHA-256; backend only
  -- deleted_at          TIMESTAMPTZ                -- Soft delete; backend only
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
