-- Add Sync Agent API keys before the original RLS baseline.
--
-- The following 20260407104500 RLS migration enables RLS and creates the
-- tenant policy for this table. Keep those statements there so already-applied
-- migrations keep their checksum.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'peopleflow_app') THEN
        CREATE ROLE peopleflow_app WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "SyncApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastHeartbeat" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "agentVersion" TEXT,
    "agentIp" TEXT,
    "syncCount" INTEGER NOT NULL DEFAULT 0,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "SyncApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyncApiKey_key_key" ON "SyncApiKey"("key");
CREATE INDEX IF NOT EXISTS "SyncApiKey_organizationId_idx" ON "SyncApiKey"("organizationId");
CREATE INDEX IF NOT EXISTS "SyncApiKey_key_idx" ON "SyncApiKey"("key");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'SyncApiKey_organizationId_fkey'
          AND conrelid = '"SyncApiKey"'::regclass
    ) THEN
        ALTER TABLE "SyncApiKey"
            ADD CONSTRAINT "SyncApiKey_organizationId_fkey"
            FOREIGN KEY ("organizationId")
            REFERENCES "Organization"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "SyncApiKey" TO peopleflow_app;
