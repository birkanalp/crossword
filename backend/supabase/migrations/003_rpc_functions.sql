-- =============================================================================
-- Migration: 003_rpc_functions
-- Description: Database-side RPC functions called by Edge Functions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- increment_coins: atomic balance update
-- Called by submitScore after inserting the coin_transactions row.
-- Using a separate RPC avoids a read-modify-write race condition.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_coins(p_user_id UUID, p_amount INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as table owner (bypasses RLS for this write)
AS $$
BEGIN
  INSERT INTO coins (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance    = coins.balance + EXCLUDED.balance,
    updated_at = NOW();
END;
$$;

-- ---------------------------------------------------------------------------
-- get_leaderboard: efficient ranked page for a level
-- Returns top-N entries with RANK() computed server-side.
-- Avoids N+1 by joining in a single query.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_level_id   UUID,
  p_limit      INT  DEFAULT 100,
  p_offset     INT  DEFAULT 0,
  p_date_filter DATE DEFAULT NULL   -- non-null = daily leaderboard filter
)
RETURNS TABLE (
  rank            BIGINT,
  user_id         UUID,
  score           INT,
  completion_time INT,
  hints_used      INT,
  created_at      TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    RANK() OVER (ORDER BY le.score DESC) AS rank,
    le.user_id,
    le.score,
    le.completion_time,
    le.hints_used,
    le.created_at
  FROM leaderboard_entries le
  WHERE
    le.level_id = p_level_id
    AND (p_date_filter IS NULL OR le.created_at::date = p_date_filter)
  ORDER BY le.score DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

-- ---------------------------------------------------------------------------
-- get_user_rank: single-user rank lookup without a full table scan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_rank(p_level_id UUID, p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*) + 1
  FROM leaderboard_entries
  WHERE level_id = p_level_id
    AND score > (
      SELECT score
      FROM leaderboard_entries
      WHERE level_id = p_level_id
        AND user_id  = p_user_id
    );
$$;

-- ---------------------------------------------------------------------------
-- get_or_create_daily_challenge: returns today's challenge level_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_daily_challenge(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (level_id UUID, leaderboard_enabled BOOLEAN)
LANGUAGE sql
STABLE
AS $$
  SELECT dc.level_id, dc.leaderboard_enabled
  FROM daily_challenges dc
  WHERE dc.date = p_date
  LIMIT 1;
$$;
