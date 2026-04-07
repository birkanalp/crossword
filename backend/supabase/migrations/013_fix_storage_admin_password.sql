-- Historical local Docker-only migration.
-- Supabase Cloud reserves supabase_storage_admin and does not allow project
-- migrations to alter it. Local storage role passwords must be handled by the
-- local environment, not production schema migration.
DO $$
BEGIN
  RAISE NOTICE '[013] Skipped local storage admin password fix in production migration.';
END $$;
