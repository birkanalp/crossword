-- post_setup.sql
-- Runs via migrate.sh's postinit hook AFTER all Supabase roles are created.
-- 1) Sets passwords for internal service accounts.
-- 2) Transfers auth function ownership to supabase_auth_admin so GoTrue
--    can apply its own migrations without permission errors.
-- Password value must match POSTGRES_PASSWORD in .env.

-- ── Passwords ─────────────────────────────────────────────────────────────────
ALTER USER supabase_auth_admin    WITH PASSWORD 'your-super-secret-and-long-postgres-password';
ALTER USER supabase_storage_admin WITH PASSWORD 'your-super-secret-and-long-postgres-password';
ALTER USER authenticator          WITH PASSWORD 'your-super-secret-and-long-postgres-password';

-- ── Auth function ownership ────────────────────────────────────────────────────
-- These 3 functions are created by the postgres image owned by 'postgres',
-- but GoTrue connects as supabase_auth_admin and needs to replace them.
ALTER FUNCTION auth.uid()   OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.role()  OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;
