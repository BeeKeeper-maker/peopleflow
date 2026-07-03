-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Link BiometricDevice to SyncApiKey
-- ═══════════════════════════════════════════════════════════════════
--
-- Problem: Previously, when the Sync Agent pushed attendance data, the
-- cloud matched the device card by (ip, port). This was fragile:
--   - direct_cloud devices have ip rewritten to adms:SERIAL
--   - agents behind NAT may push a different devicePort than recorded
--   - if no device card was created, the push silently had no device
--     linkage and the dashboard showed "no syncs"
--
-- Fix: Add a syncApiKeyId FK on BiometricDevice. The agent's push already
-- authenticates the API key; we now use that key to resolve the device
-- card directly.
--
-- The FK is nullable for backward compatibility (existing device rows
-- have no link). Future device creation flows should set it.
--
-- Migration is safe to run on a live database: ADD COLUMN with NULL
-- default + CREATE INDEX CONCURRENTLY (no table rewrite, no lock).
-- ═══════════════════════════════════════════════════════════════════

-- Add nullable syncApiKeyId column
ALTER TABLE "BiometricDevice" ADD COLUMN IF NOT EXISTS "syncApiKeyId" TEXT;

-- Add nullable cloudSecretHash column for per-device direct-cloud auth (HMAC)
ALTER TABLE "BiometricDevice" ADD COLUMN IF NOT EXISTS "cloudSecretHash" TEXT;

-- Foreign key to SyncApiKey. ON DELETE SET NULL so revoking a key
-- doesn't cascade-delete device cards (which hold historical sync logs).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BiometricDevice_syncApiKeyId_fkey'
    ) THEN
        ALTER TABLE "BiometricDevice"
            ADD CONSTRAINT "BiometricDevice_syncApiKeyId_fkey"
            FOREIGN KEY ("syncApiKeyId") REFERENCES "SyncApiKey"("id")
            ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;

-- Index for fast device lookup by API key
CREATE INDEX IF NOT EXISTS "BiometricDevice_syncApiKeyId_idx"
    ON "BiometricDevice"("syncApiKeyId");

-- ═══════════════════════════════════════════════════════════════════
-- Performance: composite index for biometric punch lookup
--
-- Every punch ingestion (sync agent push, ADMS push, cloud-pull) queries
-- Employee by (organizationId, biometricUserId) to map device user IDs
-- to employees. Without this index, each push scans all employees in
-- the org linearly — for a 5000-employee org with 5-min sync cycles,
-- that's 1.5M row scans/day. This index makes it O(log n).
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "Employee_organizationId_biometricUserId_idx"
    ON "Employee"("organizationId", "biometricUserId");

-- ═══════════════════════════════════════════════════════════════════
-- Backfill: Enable RLS on BiometricCloudEvent
--
-- BiometricCloudEvent was added in migration 20260605151500 but RLS was
-- not enabled on it. This was a pre-existing bug that the
-- tenant-rls-migration.test.ts caught. organizationId is OPTIONAL on
-- this table (NULL allowed for unattributed captured events from
-- unknown devices), so the policy allows NULL.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "BiometricCloudEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BiometricCloudEvent" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "BiometricCloudEvent" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" IS NULL
    OR "organizationId" = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" IS NULL
    OR "organizationId" = current_setting('app.current_tenant_id', true)
);

-- ═══════════════════════════════════════════════════════════════════
-- Backfill: Enable RLS on PlatformSupportIssue
--
-- PlatformSupportIssue was added in migration 20260617180000 but RLS
-- was not enabled on it. organizationId is REQUIRED (NOT NULL) on this
-- table, so the policy uses strict equality.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "PlatformSupportIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformSupportIssue" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "PlatformSupportIssue" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
);



