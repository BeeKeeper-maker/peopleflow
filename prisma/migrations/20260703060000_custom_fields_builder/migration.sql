-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Custom Fields Builder
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds CustomField table for admin-defined fields on standard entities.
-- Values are stored in each entity's existing `customFields` JSONB column.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "CustomField" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomField_organizationId_entityType_key_key"
    ON "CustomField"("organizationId", "entityType", "key");

CREATE INDEX IF NOT EXISTS "CustomField_organizationId_entityType_idx"
    ON "CustomField"("organizationId", "entityType");

CREATE INDEX IF NOT EXISTS "CustomField_isActive_idx" ON "CustomField"("isActive");

ALTER TABLE "CustomField"
    ADD CONSTRAINT "CustomField_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE;

-- RLS
ALTER TABLE "CustomField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomField" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "CustomField" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
);
