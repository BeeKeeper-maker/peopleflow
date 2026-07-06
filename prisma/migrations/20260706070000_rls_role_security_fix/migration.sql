-- ═══════════════════════════════════════════════════════════════════
-- RLS Role Security Fix
-- ═══════════════════════════════════════════════════════════════════
--
-- Fixes two critical issues from security audit:
-- 1. P0-1: App connected as 'peopleflow' (SUPERUSER) → RLS bypassed
-- 2. P0-6: peopleflow_app password hardcoded as 'CHANGE_ME_IN_PRODUCTION'
--
-- This migration:
-- - Ensures peopleflow_app role exists with NOSUPERUSER
-- - Grants all necessary privileges
-- - The actual password is set by the entrypoint script post-migration
--   using: ALTER ROLE peopleflow_app WITH PASSWORD '<env_var>'
--
-- IMPORTANT: After this migration, the application MUST connect as
-- peopleflow_app (not peopleflow) for RLS to be enforced.
-- The peopleflow (superuser) role should ONLY be used for migrations.
-- ═══════════════════════════════════════════════════════════════════

-- ── Step 1: Ensure peopleflow_app role exists (NOSUPERUSER) ──────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'peopleflow_app') THEN
        CREATE ROLE peopleflow_app WITH LOGIN PASSWORD 'temp_password_change_me' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    ELSE
        -- Ensure existing role is NOSUPERUSER (in case it was created wrongly)
        ALTER ROLE peopleflow_app NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

-- ── Step 2: Grant privileges ─────────────────────────────────────
GRANT USAGE ON SCHEMA public TO peopleflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO peopleflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO peopleflow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO peopleflow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO peopleflow_app;

-- ── Step 3: Ensure RLS is FORCED on all existing tenant tables ───
-- (Re-assert FORCE in case any were missed)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = pg_tables.tablename
            AND column_name = 'organizationId'
        )
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    END LOOP;
END
$$;

-- Note: The actual password for peopleflow_app should be set via:
--   ALTER ROLE peopleflow_app WITH PASSWORD '<real_password>';
-- This is done by docker/entrypoint.sh using PF_APP_DB_PASSWORD env var.
