-- Migration: ad_events table for tracking rewarded ad completions
-- Tracks when users start, complete, skip, or fail rewarded ads.
-- Both authenticated users (user_id) and anonymous guests (guest_id) are supported.
-- The admin metrics overview queries this table for ads_watched_today.

CREATE TABLE IF NOT EXISTS ad_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_id     UUID,
  event_type   TEXT NOT NULL CHECK (event_type IN ('started', 'completed', 'skipped', 'failed')),
  action_type  TEXT NOT NULL CHECK (action_type IN ('reveal_letter', 'show_hint')),
  level_id     UUID REFERENCES levels(id) ON DELETE SET NULL,
  ad_unit_id   TEXT NOT NULL,
  platform     TEXT CHECK (platform IN ('ios', 'android')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ad_events IS 'Rewarded ad event log. One row per ad lifecycle event. Supports both authenticated users and anonymous guests.';
COMMENT ON COLUMN ad_events.user_id IS 'Authenticated user. NULL for guest sessions.';
COMMENT ON COLUMN ad_events.guest_id IS 'Anonymous guest UUID. NULL for authenticated sessions.';
COMMENT ON COLUMN ad_events.event_type IS 'Ad lifecycle: started | completed | skipped | failed.';
COMMENT ON COLUMN ad_events.action_type IS 'Game action unlocked by this ad: reveal_letter | show_hint.';
COMMENT ON COLUMN ad_events.ad_unit_id IS 'AdMob/AppLovin ad unit identifier as configured in the client.';
COMMENT ON COLUMN ad_events.platform IS 'Client platform: ios | android.';

-- Indexes for admin metrics queries and per-user lookups
CREATE INDEX IF NOT EXISTS idx_ad_events_created_at ON ad_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_events_user_id    ON ad_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_events_event_type ON ad_events(event_type);

-- Composite index used by the admin metrics overview query:
--   SELECT count(*) WHERE event_type = 'completed' AND created_at >= <today>
CREATE INDEX IF NOT EXISTS idx_ad_events_completed_today
  ON ad_events(event_type, created_at DESC)
  WHERE event_type = 'completed';

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE ad_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own events
CREATE POLICY "users_insert_own_ad_events" ON ad_events
  FOR INSERT WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid()) OR
    (guest_id IS NOT NULL AND user_id IS NULL)
  );

-- Authenticated users can read only their own events
CREATE POLICY "users_read_own_ad_events" ON ad_events
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Service role (used by edge functions / admin) bypasses RLS automatically
-- No explicit service-role policy needed.
