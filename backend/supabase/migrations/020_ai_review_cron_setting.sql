-- Migration: 020_ai_review_cron_setting
-- Adds the ai_review_cron_enabled key to app_settings.
-- Default: disabled. Enable only after OLLAMA_BASE_URL and pending puzzle
-- review workflow are verified in production.

INSERT INTO app_settings (key, value, updated_at)
VALUES ('ai_review_cron_enabled', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
