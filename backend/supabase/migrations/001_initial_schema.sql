-- =============================================================================
-- Migration: 001_initial_schema
-- Description: Full initial schema for Crossword Puzzle Game
-- Date: 2026-02-21
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- For gen_random_uuid() + SHA-256

-- ---------------------------------------------------------------------------
-- Enum Types
-- ---------------------------------------------------------------------------
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE purchase_source   AS ENUM ('app_store', 'play_store', 'promotional');
CREATE TYPE coin_tx_type      AS ENUM ('earn', 'spend', 'refund', 'bonus');

-- ---------------------------------------------------------------------------
-- Helper: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- TABLE: levels
-- Stores crossword puzzle definitions. Never mutated in place;
-- increment `version` and soft-delete the old row instead.
-- ---------------------------------------------------------------------------
CREATE TABLE levels (
  id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  version              INT             NOT NULL DEFAULT 1 CHECK (version >= 1),
  difficulty           difficulty_level NOT NULL,
  is_premium           BOOLEAN         NOT NULL DEFAULT FALSE,

  -- Grid and clue data (structure validated below via CHECK)
  grid_json            JSONB           NOT NULL,
  clues_json           JSONB           NOT NULL,

  -- SHA-256(level_id || ':' || version || ':' || sorted_canonical_answers)
  -- Computed server-side when level is inserted; never sent to client.
  answer_hash          TEXT            NOT NULL,

  -- Multiplier used in scoring formula (1.0 = easy, 1.5 = medium, 2.0 = hard)
  difficulty_multiplier NUMERIC(4,2)  NOT NULL DEFAULT 1.0
    CHECK (difficulty_multiplier > 0),

  created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ     -- soft-delete; NULL = active
);

-- Structural integrity: grid_json must contain required keys
ALTER TABLE levels ADD CONSTRAINT chk_grid_json_structure
  CHECK (
    grid_json ? 'rows'  AND
    grid_json ? 'cols'  AND
    grid_json ? 'cells'
  );

-- Structural integrity: clues_json must contain required keys
ALTER TABLE levels ADD CONSTRAINT chk_clues_json_structure
  CHECK (
    clues_json ? 'across' AND
    clues_json ? 'down'
  );

-- answer_hash must look like a hex SHA-256 (64 chars)
ALTER TABLE levels ADD CONSTRAINT chk_answer_hash_format
  CHECK (answer_hash ~ '^[0-9a-f]{64}$');

-- Indexes
CREATE INDEX idx_levels_difficulty  ON levels (difficulty)  WHERE deleted_at IS NULL;
CREATE INDEX idx_levels_is_premium  ON levels (is_premium)  WHERE deleted_at IS NULL;
CREATE INDEX idx_levels_version     ON levels (version);
CREATE INDEX idx_levels_created_at  ON levels (created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_levels_updated_at
  BEFORE UPDATE ON levels
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: user_progress
-- One row per (user OR guest) × level.
-- Exactly one of user_id / guest_id must be non-null (enforced by CHECK).
-- ---------------------------------------------------------------------------
CREATE TABLE user_progress (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  guest_id     UUID,       -- client-generated UUID, stored locally on device

  level_id     UUID        NOT NULL REFERENCES levels (id) ON DELETE RESTRICT,

  -- Full puzzle state: filled cells, revealed cells, etc.
  state_json   JSONB       NOT NULL DEFAULT '{}',

  completed_at TIMESTAMPTZ,           -- NULL = in progress
  time_spent   INT         NOT NULL DEFAULT 0  CHECK (time_spent >= 0),  -- seconds
  mistakes     INT         NOT NULL DEFAULT 0  CHECK (mistakes >= 0),
  hints_used   INT         NOT NULL DEFAULT 0  CHECK (hints_used >= 0),

  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one owner
  CONSTRAINT chk_progress_owner CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL) OR
    (user_id IS NULL     AND guest_id IS NOT NULL)
  )
);

-- Unique progress per authenticated user per level
CREATE UNIQUE INDEX uidx_progress_user_level
  ON user_progress (user_id, level_id)
  WHERE user_id IS NOT NULL;

-- Unique progress per guest per level
CREATE UNIQUE INDEX uidx_progress_guest_level
  ON user_progress (guest_id, level_id)
  WHERE guest_id IS NOT NULL;

-- Support lookups by level (leaderboard joins, admin queries)
CREATE INDEX idx_progress_level_id    ON user_progress (level_id);
CREATE INDEX idx_progress_completed   ON user_progress (completed_at)
  WHERE completed_at IS NOT NULL;
CREATE INDEX idx_progress_guest_id    ON user_progress (guest_id)
  WHERE guest_id IS NOT NULL;

CREATE TRIGGER trg_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: daily_challenges
-- Maps a calendar date to a level. One row per date.
-- ---------------------------------------------------------------------------
CREATE TABLE daily_challenges (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  date                 DATE    NOT NULL UNIQUE,
  level_id             UUID    NOT NULL REFERENCES levels (id) ON DELETE RESTRICT,
  leaderboard_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_challenges_date ON daily_challenges (date DESC);

-- ---------------------------------------------------------------------------
-- TABLE: leaderboard_entries
-- One entry per (user × level). ON CONFLICT UPDATE keeps the best score.
-- ---------------------------------------------------------------------------
CREATE TABLE leaderboard_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  level_id        UUID        NOT NULL REFERENCES levels (id)     ON DELETE CASCADE,

  score           INT         NOT NULL CHECK (score >= 0),
  completion_time INT         NOT NULL CHECK (completion_time > 0), -- seconds
  hints_used      INT         NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  mistakes        INT         NOT NULL DEFAULT 0 CHECK (mistakes >= 0),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Best score wins; one row per user per level
  UNIQUE (user_id, level_id)
);

-- Primary leaderboard query: rank all users for a given level
CREATE INDEX idx_leaderboard_level_score
  ON leaderboard_entries (level_id, score DESC);

-- Lookup user's own entries
CREATE INDEX idx_leaderboard_user
  ON leaderboard_entries (user_id);

-- Daily leaderboard filtering (range query on timestamptz is IMMUTABLE-safe)
CREATE INDEX idx_leaderboard_created_date
  ON leaderboard_entries (created_at);

-- ---------------------------------------------------------------------------
-- TABLE: entitlements
-- One row per user; tracks Pro subscription status.
-- ---------------------------------------------------------------------------
CREATE TABLE entitlements (
  id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID            NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  is_pro     BOOLEAN         NOT NULL DEFAULT FALSE,
  source     purchase_source,
  expires_at TIMESTAMPTZ,   -- NULL = lifetime / perpetual
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entitlements_user ON entitlements (user_id);

CREATE TRIGGER trg_entitlements_updated_at
  BEFORE UPDATE ON entitlements
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: streaks
-- Daily completion streaks per authenticated user.
-- ---------------------------------------------------------------------------
CREATE TABLE streaks (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID  NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  current_streak      INT   NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak      INT   NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_completed_date DATE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_streaks_updated_at
  BEFORE UPDATE ON streaks
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: coins  (wallet balance)
-- ---------------------------------------------------------------------------
CREATE TABLE coins (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID  NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  balance    INT   NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_coins_updated_at
  BEFORE UPDATE ON coins
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: coin_transactions  (append-only ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE coin_transactions (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount     INT          NOT NULL,  -- positive = earn, negative = spend
  type       coin_tx_type NOT NULL,
  metadata   JSONB        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coin_tx_user_time
  ON coin_transactions (user_id, created_at DESC);
