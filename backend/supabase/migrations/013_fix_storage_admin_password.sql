-- Fix supabase_storage_admin role password.
-- The storage container authenticates as this role using POSTGRES_PASSWORD.
-- This ensures the role has a password set after a fresh volume / docker:reset.
ALTER ROLE supabase_storage_admin WITH PASSWORD 'your-super-secret-and-long-postgres-password';
