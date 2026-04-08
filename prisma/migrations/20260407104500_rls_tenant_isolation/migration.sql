-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Row-Level Security (RLS) Migration
-- ═══════════════════════════════════════════════════════════════════
--
-- Enforces database-level tenant isolation on ALL 31 org-scoped tables.
--
-- Mechanism:
--   SET LOCAL app.current_tenant_id = '<org_id>';   → tenant context
--   SET LOCAL app.rls_bypass = 'true';              → platform admin bypass
--
-- IMPORTANT: PostgreSQL superusers ALWAYS bypass RLS.
-- The application must connect as a non-superuser role for RLS enforcement.
-- This migration creates the `peopleflow_app` role for that purpose.
-- ═══════════════════════════════════════════════════════════════════

-- ── Step 1: Create application role (if not exists) ──────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'peopleflow_app') THEN
        CREATE ROLE peopleflow_app WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO peopleflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO peopleflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO peopleflow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO peopleflow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO peopleflow_app;

-- ── Step 2: Enable RLS on all tenant-scoped tables ───────────────
-- FORCE ensures RLS applies even to table owners (not superusers though)

-- Required organizationId (30 tables)
ALTER TABLE "Announcement"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "Application"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalRequest"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalRequest"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalWorkflow"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalWorkflow"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "BiometricDevice"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BiometricDevice"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "Branch"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "Candidate"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Candidate"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "Department"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "Designation"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Designation"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "DocumentRequest"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentRequest"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "Employee"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseCategory"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseCategory"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseClaim"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseClaim"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "FestivalBonusConfig"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FestivalBonusConfig"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "Goal"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Goal"                 FORCE ROW LEVEL SECURITY;
ALTER TABLE "HolidayList"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HolidayList"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "JobPosting"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobPosting"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "LateDeductionPolicy"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LateDeductionPolicy"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "LeaveType"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveType"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "PFAccount"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PFAccount"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceReview"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceReview"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "RBACPermission"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RBACPermission"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "ReviewCycle"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewCycle"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "SalaryStructure"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalaryStructure"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "Shift"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shift"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "Subscription"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "SyncApiKey"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncApiKey"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "UsageRecord"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageRecord"          FORCE ROW LEVEL SECURITY;

-- Optional organizationId (User table — allows NULL for unaffiliated users)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

-- ── Step 3: Create tenant isolation policies ─────────────────────
-- Pattern: Allow if rls_bypass=true OR organizationId matches current_tenant_id
-- current_setting(..., true) returns NULL instead of error when not set

-- Required organizationId tables (30)
CREATE POLICY tenant_isolation ON "Announcement" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "ApiKey" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "Application" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "ApprovalRequest" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "ApprovalWorkflow" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "AuditLog" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "BiometricDevice" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "Branch" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "Candidate" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "Department" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "Designation" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "DocumentRequest" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "Employee" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "ExpenseCategory" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "ExpenseClaim" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "FestivalBonusConfig" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "Goal" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "HolidayList" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "JobPosting" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "LateDeductionPolicy" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "LeaveType" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "PFAccount" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "PerformanceReview" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "RBACPermission" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "ReviewCycle" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "SalaryStructure" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "Shift" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "Subscription" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "SyncApiKey" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON "UsageRecord" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true' OR "organizationId" = current_setting('app.current_tenant_id', true));

-- User table: organizationId is OPTIONAL (NULL allowed for unaffiliated users)
CREATE POLICY tenant_isolation ON "User" FOR ALL
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
