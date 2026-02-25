-- Add admin user to auth.users (DB'yi sıfırlamaz, sadece bu kullanıcıyı ekler/günceller)
-- Çalıştırma: npm run admin:add-user

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@bulmaca.local',
    crypt('Admin123!', gen_salt('bf', 10)),
    now(),
    '',
    '',
    '',
    '',
    '{"role":"admin"}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (email) WHERE (is_sso_user = false) DO UPDATE SET
    encrypted_password = crypt('Admin123!', gen_salt('bf', 10)),
    confirmation_token = '',
    email_change = '',
    email_change_token_new = '',
    recovery_token = '',
    raw_app_meta_data = COALESCE(auth.users.raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb,
    updated_at = now();

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider)
SELECT u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', 'admin@bulmaca.local'), 'email'
FROM (SELECT id FROM auth.users WHERE email = 'admin@bulmaca.local') u
ON CONFLICT (provider_id, provider) DO NOTHING;
