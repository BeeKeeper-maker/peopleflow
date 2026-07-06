-- ═══════════════════════════════════════════════════════════════════
-- RLS Complete Coverage Migration
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds RLS policies to ALL remaining org-scoped tables.
--
-- Two categories:
-- 1. Tables that already have organizationId → direct RLS policy
-- 2. Tables without organizationId → add column + backfill + RLS policy
--
-- The denormalization (adding organizationId to child tables) is the
-- industry best practice for multi-tenant RLS — it avoids expensive
-- JOINs in RLS policies and prevents cross-tenant data leaks.
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- PART 1: Tables that already have organizationId — add RLS directly
-- ═══════════════════════════════════════════════════════════════════

-- LeaveEncashmentRequest
ALTER TABLE "LeaveEncashmentRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveEncashmentRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LeaveEncashmentRequest" FOR ALL
    USING (organizationId = current_setting('app.current_tenant_id', true))
    WITH CHECK (organizationId = current_setting('app.current_tenant_id', true));

-- SalaryDisbursement
ALTER TABLE "SalaryDisbursement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalaryDisbursement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SalaryDisbursement" FOR ALL
    USING (organizationId = current_setting('app.current_tenant_id', true))
    WITH CHECK (organizationId = current_setting('app.current_tenant_id', true));

-- CustomField
ALTER TABLE "CustomField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomField" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CustomField" FOR ALL
    USING (organizationId = current_setting('app.current_tenant_id', true))
    WITH CHECK (organizationId = current_setting('app.current_tenant_id', true));

-- SavedReport
ALTER TABLE "SavedReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SavedReport" FOR ALL
    USING (organizationId = current_setting('app.current_tenant_id', true))
    WITH CHECK (organizationId = current_setting('app.current_tenant_id', true));

-- ScheduledReport
ALTER TABLE "ScheduledReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduledReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ScheduledReport" FOR ALL
    USING (organizationId = current_setting('app.current_tenant_id', true))
    WITH CHECK (organizationId = current_setting('app.current_tenant_id', true));

-- Role (RBAC v2 custom roles — org-scoped, system roles have NULL organizationId)
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Role" FOR ALL
    USING (
        organizationId IS NULL -- system roles visible to all
        OR organizationId = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        organizationId IS NULL
        OR organizationId = current_setting('app.current_tenant_id', true)
    );

-- UserRoleAssignment
ALTER TABLE "UserRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRoleAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "UserRoleAssignment" FOR ALL
    USING (organizationId = current_setting('app.current_tenant_id', true))
    WITH CHECK (organizationId = current_setting('app.current_tenant_id', true));

-- BiometricCloudEvent
ALTER TABLE "BiometricCloudEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BiometricCloudEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BiometricCloudEvent" FOR ALL
    USING (organizationId = current_setting('app.current_tenant_id', true))
    WITH CHECK (organizationId = current_setting('app.current_tenant_id', true));

-- Notification
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Notification" FOR ALL
    USING (
        "userId" IN (
            SELECT id FROM "User"
            WHERE organizationId = current_setting('app.current_tenant_id', true)
        )
    )
    WITH CHECK (
        "userId" IN (
            SELECT id FROM "User"
            WHERE organizationId = current_setting('app.current_tenant_id', true)
        )
    );

-- ═══════════════════════════════════════════════════════════════════
-- PART 2: Tables WITHOUT organizationId — denormalize + RLS
-- ═══════════════════════════════════════════════════════════════════

-- ── Attendance → add organizationId, backfill from Employee ──
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Attendance" a SET "organizationId" = e."organizationId"
    FROM "Employee" e WHERE a."employeeId" = e.id;
CREATE INDEX IF NOT EXISTS "Attendance_organizationId_idx" ON "Attendance"("organizationId");
ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Attendance" FOR ALL
    USING ("organizationId" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', true));

-- ── LeaveApplication → add organizationId, backfill from Employee ──
ALTER TABLE "LeaveApplication" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "LeaveApplication" la SET "organizationId" = e."organizationId"
    FROM "Employee" e WHERE la."employeeId" = e.id;
CREATE INDEX IF NOT EXISTS "LeaveApplication_organizationId_idx" ON "LeaveApplication"("organizationId");
ALTER TABLE "LeaveApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveApplication" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LeaveApplication" FOR ALL
    USING ("organizationId" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', true));

-- ── LeaveAllocation → add organizationId, backfill from Employee ──
ALTER TABLE "LeaveAllocation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "LeaveAllocation" la SET "organizationId" = e."organizationId"
    FROM "Employee" e WHERE la."employeeId" = e.id;
CREATE INDEX IF NOT EXISTS "LeaveAllocation_organizationId_idx" ON "LeaveAllocation"("organizationId");
ALTER TABLE "LeaveAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveAllocation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LeaveAllocation" FOR ALL
    USING ("organizationId" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', true));

-- ── SalarySlip → add organizationId, backfill from Employee ──
ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "SalarySlip" ss SET "organizationId" = e."organizationId"
    FROM "Employee" e WHERE ss."employeeId" = e.id;
CREATE INDEX IF NOT EXISTS "SalarySlip_organizationId_idx" ON "SalarySlip"("organizationId");
ALTER TABLE "SalarySlip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalarySlip" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SalarySlip" FOR ALL
    USING ("organizationId" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', true));

-- ── SalaryStructureAssignment → add organizationId, backfill from Employee ──
ALTER TABLE "SalaryStructureAssignment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "SalaryStructureAssignment" ssa SET "organizationId" = e."organizationId"
    FROM "Employee" e WHERE ssa."employeeId" = e.id;
CREATE INDEX IF NOT EXISTS "SalaryStructureAssignment_organizationId_idx" ON "SalaryStructureAssignment"("organizationId");
ALTER TABLE "SalaryStructureAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalaryStructureAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SalaryStructureAssignment" FOR ALL
    USING ("organizationId" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', true));

-- ── Loan → add organizationId, backfill from Employee ──
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Loan" l SET "organizationId" = e."organizationId"
    FROM "Employee" e WHERE l."employeeId" = e.id;
CREATE INDEX IF NOT EXISTS "Loan_organizationId_idx" ON "Loan"("organizationId");
ALTER TABLE "Loan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Loan" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Loan" FOR ALL
    USING ("organizationId" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', true));

-- ── FestivalBonusPayment → add organizationId, backfill from Employee ──
ALTER TABLE "FestivalBonusPayment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "FestivalBonusPayment" fbp SET "organizationId" = e."organizationId"
    FROM "Employee" e WHERE fbp."employeeId" = e.id;
CREATE INDEX IF NOT EXISTS "FestivalBonusPayment_organizationId_idx" ON "FestivalBonusPayment"("organizationId");
ALTER TABLE "FestivalBonusPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FestivalBonusPayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FestivalBonusPayment" FOR ALL
    USING ("organizationId" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', true));

-- ── PFTransaction → add organizationId, backfill from PFAccount → Employee ──
ALTER TABLE "PFTransaction" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "PFTransaction" pft SET "organizationId" = e."organizationId"
    FROM "PFAccount" pfa JOIN "Employee" e ON pfa."employeeId" = e.id
    WHERE pft."pfAccountId" = pfa.id;
CREATE INDEX IF NOT EXISTS "PFTransaction_organizationId_idx" ON "PFTransaction"("organizationId");
ALTER TABLE "PFTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PFTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PFTransaction" FOR ALL
    USING ("organizationId" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', true));

-- ── EmployeeDocument → add organizationId, backfill from Employee ──
ALTER TABLE "EmployeeDocument" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "EmployeeDocument" ed SET "organizationId" = e."organizationId"
    FROM "Employee" e WHERE ed."employeeId" = e.id;
CREATE INDEX IF NOT EXISTS "EmployeeDocument_organizationId_idx" ON "EmployeeDocument"("organizationId");
ALTER TABLE "EmployeeDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeDocument" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EmployeeDocument" FOR ALL
    USING ("organizationId" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', true));

-- ═══════════════════════════════════════════════════════════════════
-- PART 3: Platform bypass policy for all new RLS tables
-- ═══════════════════════════════════════════════════════════════════

-- Platform admin bypass (same pattern as original RLS migration)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'LeaveEncashmentRequest', 'SalaryDisbursement', 'CustomField',
            'SavedReport', 'ScheduledReport', 'Role', 'UserRoleAssignment',
            'BiometricCloudEvent', 'Notification',
            'Attendance', 'LeaveApplication', 'LeaveAllocation',
            'SalarySlip', 'SalaryStructureAssignment', 'Loan',
            'FestivalBonusPayment', 'PFTransaction', 'EmployeeDocument'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY platform_bypass ON %I FOR ALL
             USING (current_setting(''app.rls_bypass'', true) = ''true'')
             WITH CHECK (current_setting(''app.rls_bypass'', true) = ''true'')',
            tbl
        );
    END LOOP;
END
$$;

-- Grant privileges to peopleflow_app for new columns/tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO peopleflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO peopleflow_app;
