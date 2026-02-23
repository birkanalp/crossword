-- =============================================================================
-- Migration: 002_rls_policies
-- Description: Row-Level Security for all tables
-- Principle: Deny by default; only grant minimum required access.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- levels  (public read for non-premium; premium gated by entitlements)
-- Only service_role can INSERT/UPDATE/DELETE.
-- ---------------------------------------------------------------------------
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "levels: anyone can read non-premium active levels"
  ON levels FOR SELECT
  USING (
    deleted_at IS NULL AND
    (
      is_premium = FALSE
      OR
      -- Pro users can read premium levels
      EXISTS (
        SELECT 1 FROM entitlements e
        WHERE e.user_id = auth.uid()
          AND e.is_pro = TRUE
          AND (e.expires_at IS NULL OR e.expires_at > NOW())
      )
    )
  );

-- No INSERT/UPDATE/DELETE policies → only service_role (bypasses RLS) can write.

-- ---------------------------------------------------------------------------
-- user_progress
-- Users can only see and modify their own rows.
-- Guests access their rows via guest_id (passed in JWT claims or request).
-- Edge Functions run as service_role and bypass RLS for migration operations.
-- ---------------------------------------------------------------------------
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress: authenticated users read own rows"
  ON user_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "progress: authenticated users insert own rows"
  ON user_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND guest_id IS NULL);

CREATE POLICY "progress: authenticated users update own rows"
  ON user_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Anon users (guests) cannot directly access user_progress via REST API.
-- All guest operations must go through Edge Functions (service_role).

-- ---------------------------------------------------------------------------
-- daily_challenges  (public read)
-- ---------------------------------------------------------------------------
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_challenges: anyone can read"
  ON daily_challenges FOR SELECT
  USING (TRUE);

-- ---------------------------------------------------------------------------
-- leaderboard_entries  (public read; insert/update via Edge Function only)
-- ---------------------------------------------------------------------------
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaderboard: anyone can read"
  ON leaderboard_entries FOR SELECT
  USING (TRUE);

-- Users cannot directly write leaderboard entries; submitScore Edge Function
-- (service_role) handles validated inserts.

-- ---------------------------------------------------------------------------
-- entitlements  (users read own; RevenueCat webhook writes via service_role)
-- ---------------------------------------------------------------------------
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entitlements: users read own"
  ON entitlements FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- streaks  (users read/update own)
-- ---------------------------------------------------------------------------
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streaks: users read own"
  ON streaks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "streaks: users update own"
  ON streaks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- coins  (users read own; all writes via Edge Functions / service_role)
-- ---------------------------------------------------------------------------
ALTER TABLE coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coins: users read own"
  ON coins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- coin_transactions  (users read own; append-only via service_role)
-- ---------------------------------------------------------------------------
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coin_transactions: users read own"
  ON coin_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Leaderboard view: ranked entries per level with user display info
-- Used by getLeaderboard edge function (service_role bypasses RLS).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_leaderboard_ranked AS
SELECT
  le.id,
  le.level_id,
  le.user_id,
  au.email,                    -- swap for profiles.display_name when added
  le.score,
  le.completion_time,
  le.hints_used,
  le.mistakes,
  le.created_at,
  RANK() OVER (
    PARTITION BY le.level_id
    ORDER BY le.score DESC
  ) AS rank
FROM leaderboard_entries le
JOIN auth.users au ON au.id = le.user_id;

-- Daily leaderboard view: entries created on the current date
CREATE OR REPLACE VIEW v_daily_leaderboard_ranked AS
SELECT
  le.id,
  dc.date,
  le.level_id,
  le.user_id,
  au.email,
  le.score,
  le.completion_time,
  le.hints_used,
  le.mistakes,
  le.created_at,
  RANK() OVER (
    PARTITION BY le.level_id
    ORDER BY le.score DESC
  ) AS rank
FROM leaderboard_entries le
JOIN daily_challenges dc ON dc.level_id = le.level_id
JOIN auth.users au ON au.id = le.user_id
WHERE le.created_at::date = dc.date;
