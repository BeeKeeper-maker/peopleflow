-- ═══════════════════════════════════════════════════════════════════
-- RLS Policy Conflict Fix
-- ═══════════════════════════════════════════════════════════════════
--
-- Problem: Migration 20260706080000_rls_complete_coverage re-creates
-- `tenant_isolation` policies on 8 tables that already received a
-- `tenant_isolation` policy from an earlier migration. PostgreSQL's
-- `CREATE POLICY` does NOT support `IF NOT EXISTS`, so on a fresh DB
-- (or any DB where the earlier migration ran first), migration
-- 20260706080000 fails mid-way with:
--
--   ERROR:  policy "tenant_isolation" for table "BiometricCloudEvent" already exists
--
-- That blocks ALL later migrations (including the Attendance policy
-- creation in the same file) AND blocks the new RLS-bypass wrapper
-- code from working in production: peopleflow_app is NOSUPERUSER, so
-- raw prisma reads on these tables return NULL without the bypass
-- clause in the policy.
--
-- Conflicting tables (earlier migration → 20260706080000):
--   BiometricCloudEvent       (20260703000000_add_device_sync_api_key_relation)
--   LeaveEncashmentRequest    (20260703010000_leave_encashment_requests)
--   Role                      (20260703030000_rbac_v2_custom_roles)
--   UserRoleAssignment        (20260703030000_rbac_v2_custom_roles)
--   SavedReport               (20260703050000_custom_reports)
--   ScheduledReport           (20260703050000_custom_reports)
--   CustomField               (20260703060000_custom_fields_builder)
--   SalaryDisbursement        (20260703090000_digital_disbursement)
--
-- Fix: Drop and recreate each conflicting `tenant_isolation` policy
-- with the correct version (includes platform bypass via
-- `app.rls_bypass`). DROP POLICY IF EXISTS makes this idempotent on
-- databases where 20260706080000 already ran (and either skipped the
-- duplicates or was manually fixed).
--
-- Attendance is NOT a conflict (its policy was first created in
-- 20260706080000), but we drop+recreate it here too so the policy
-- itself carries the platform-bypass clause defensively — the
-- separate `platform_bypass` policy created in 20260706080000 is the
-- primary bypass path, but having the bypass in `tenant_isolation`
-- itself is belt-and-suspenders against future policy drops.
--
-- This migration is safe to run on a live database: DROP POLICY IF
-- EXISTS is a no-op if the policy doesn't exist, and CREATE POLICY
-- only re-creates what was just dropped. No data is touched.
-- ═══════════════════════════════════════════════════════════════════

-- ── BiometricCloudEvent ──
-- organizationId is NULLABLE (unattributed captures from unknown devices).
-- Policy allows: platform bypass OR NULL org OR org matches tenant.
DROP POLICY IF EXISTS tenant_isolation ON "BiometricCloudEvent";
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

-- ── Role ──
-- organizationId is NULLABLE (system roles are global, cross-tenant).
-- Policy allows: platform bypass OR NULL org (system role) OR org matches tenant.
DROP POLICY IF EXISTS tenant_isolation ON "Role";
CREATE POLICY tenant_isolation ON "Role" FOR ALL
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

-- ── Attendance ──
-- organizationId is REQUIRED (denormalized in 20260706080000).
-- Policy carries platform-bypass clause defensively (the separate
-- `platform_bypass` policy is the primary bypass path).
DROP POLICY IF EXISTS tenant_isolation ON "Attendance";
CREATE POLICY tenant_isolation ON "Attendance" FOR ALL
    USING (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    );

-- ── LeaveEncashmentRequest ──
DROP POLICY IF EXISTS tenant_isolation ON "LeaveEncashmentRequest";
CREATE POLICY tenant_isolation ON "LeaveEncashmentRequest" FOR ALL
    USING (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    );

-- ── SalaryDisbursement ──
DROP POLICY IF EXISTS tenant_isolation ON "SalaryDisbursement";
CREATE POLICY tenant_isolation ON "SalaryDisbursement" FOR ALL
    USING (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    );

-- ── CustomField ──
DROP POLICY IF EXISTS tenant_isolation ON "CustomField";
CREATE POLICY tenant_isolation ON "CustomField" FOR ALL
    USING (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    );

-- ── SavedReport ──
DROP POLICY IF EXISTS tenant_isolation ON "SavedReport";
CREATE POLICY tenant_isolation ON "SavedReport" FOR ALL
    USING (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    );

-- ── ScheduledReport ──
DROP POLICY IF EXISTS tenant_isolation ON "ScheduledReport";
CREATE POLICY tenant_isolation ON "ScheduledReport" FOR ALL
    USING (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    );

-- ── UserRoleAssignment ──
DROP POLICY IF EXISTS tenant_isolation ON "UserRoleAssignment";
CREATE POLICY tenant_isolation ON "UserRoleAssignment" FOR ALL
    USING (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.rls_bypass', true) = 'true'
        OR "organizationId" = current_setting('app.current_tenant_id', true)
    );
