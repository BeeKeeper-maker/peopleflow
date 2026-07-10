-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Leave Encashment Requests
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds the LeaveEncashmentRequest table to support the full encashment
-- workflow (request → approve → pay via payroll).
--
-- Previously, the /api/leaves/encashment endpoint only CALCULATED the
-- encashment amount and returned it — there was no persistence, no
-- approval workflow, and no payroll integration. The UI tab existed
-- but did nothing.
--
-- This migration:
--   1. Creates the LeaveEncashmentRequest table
--   2. Enables RLS on it (tenant isolation)
--   3. Creates indexes for common query patterns
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE "LeaveEncashmentRequest" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedDays" DOUBLE PRECISION NOT NULL,
    "encashableDays" DOUBLE PRECISION NOT NULL,
    "dailyBasicRate" DOUBLE PRECISION NOT NULL,
    "encashmentRate" DOUBLE PRECISION NOT NULL,
    "encashmentAmount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "payrollMonth" INTEGER,
    "payrollYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "allocationId" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "LeaveEncashmentRequest_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "LeaveEncashmentRequest"
    ADD CONSTRAINT "LeaveEncashmentRequest_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE;

ALTER TABLE "LeaveEncashmentRequest"
    ADD CONSTRAINT "LeaveEncashmentRequest_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id")
    ON DELETE CASCADE;

ALTER TABLE "LeaveEncashmentRequest"
    ADD CONSTRAINT "LeaveEncashmentRequest_allocationId_fkey"
    FOREIGN KEY ("allocationId") REFERENCES "LeaveAllocation"("id")
    ON DELETE SET NULL;

ALTER TABLE "LeaveEncashmentRequest"
    ADD CONSTRAINT "LeaveEncashmentRequest_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE;

-- Indexes
CREATE INDEX "LeaveEncashmentRequest_employeeId_idx" ON "LeaveEncashmentRequest"("employeeId");
CREATE INDEX "LeaveEncashmentRequest_status_idx" ON "LeaveEncashmentRequest"("status");
CREATE INDEX "LeaveEncashmentRequest_organizationId_idx" ON "LeaveEncashmentRequest"("organizationId");
CREATE INDEX "LeaveEncashmentRequest_leaveTypeId_idx" ON "LeaveEncashmentRequest"("leaveTypeId");

-- RLS (tenant isolation)
ALTER TABLE "LeaveEncashmentRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveEncashmentRequest" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "LeaveEncashmentRequest" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
);
