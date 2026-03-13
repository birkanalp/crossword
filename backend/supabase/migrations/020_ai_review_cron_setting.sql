-- Migration: 020_ai_review_cron_setting
-- Adds the ai_review_cron_enabled key to app_settings.
-- Default: enabled (true), so the daily cron script processes pending puzzles automatically.

INSERT INTO app_settings (key, value, updated_at)
VALUES ('ai_review_cron_enabled', 'true'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
