-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Custom Reports & Saved Views
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds SavedReport + ScheduledReport tables for:
--   1. User-defined custom reports (field picker, filters, chart type)
--   2. Scheduled email delivery (daily/weekly/monthly)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "SavedReport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dataSource" TEXT NOT NULL,
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filters" JSONB NOT NULL DEFAULT '{}',
    "groupBy" TEXT,
    "chartType" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedReport_organizationId_idx" ON "SavedReport"("organizationId");
CREATE INDEX IF NOT EXISTS "SavedReport_createdBy_idx" ON "SavedReport"("createdBy");
CREATE INDEX IF NOT EXISTS "SavedReport_dataSource_idx" ON "SavedReport"("dataSource");

ALTER TABLE "SavedReport"
    ADD CONSTRAINT "SavedReport_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "ScheduledReport" (
    "id" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "savedReportId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScheduledReport_nextRunAt_idx" ON "ScheduledReport"("nextRunAt");
CREATE INDEX IF NOT EXISTS "ScheduledReport_organizationId_idx" ON "ScheduledReport"("organizationId");
CREATE INDEX IF NOT EXISTS "ScheduledReport_savedReportId_idx" ON "ScheduledReport"("savedReportId");

ALTER TABLE "ScheduledReport"
    ADD CONSTRAINT "ScheduledReport_savedReportId_fkey"
    FOREIGN KEY ("savedReportId") REFERENCES "SavedReport"("id")
    ON DELETE CASCADE;

ALTER TABLE "ScheduledReport"
    ADD CONSTRAINT "ScheduledReport_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE;

-- RLS
ALTER TABLE "SavedReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedReport" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "SavedReport" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
);

ALTER TABLE "ScheduledReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduledReport" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ScheduledReport" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
);
