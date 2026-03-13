-- =============================================================================
-- Migration: 016_app_settings_cron
-- Description: app_settings table for cron job enable/disable toggle.
-- Date: 2026-02-26
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default: cron enabled
INSERT INTO app_settings (key, value, updated_at)
VALUES ('puzzle_generation_cron_enabled', 'true'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- RLS: only service_role writes; anon/authenticated cannot read (cron uses direct connection)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE for anon/authenticated → admin reads/writes via Edge Function (service_role)
