-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — RBAC v2: Custom Roles, Permission Catalog, Assignments
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds 4 new tables:
--   1. Permission — system catalog of all permission keys (35 entries)
--   2. Role — named permission sets (5 system + tenant-defined custom)
--   3. RolePermission — grants a Permission to a Role with optional scope
--   4. UserRoleAssignment — assigns a Role to a User (mirrors User.role)
--
-- Backward compatibility:
--   User.role (String) is NOT dropped. It remains the "primary role slug"
--   for fast lookup. UserRoleAssignment mirrors it for future multi-role.
--
-- The migration also:
--   - Seeds the Permission catalog with all 35 permission keys
--   - Seeds 5 system Roles (global, not tenant-scoped)
--   - Adds maxCustomRoles to Plan (0=none, -1=unlimited)
--   - Enables RLS on Role, RolePermission, UserRoleAssignment
--
-- For existing tenants, a separate seed script (scripts/seed-rbac-v2.ts)
-- will backfill Role + RolePermission + UserRoleAssignment rows per tenant.
-- ═══════════════════════════════════════════════════════════════════

-- ── Add maxCustomRoles to Plan ──
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "maxCustomRoles" INTEGER NOT NULL DEFAULT 0;

-- ── 1. Permission catalog ──
CREATE TABLE IF NOT EXISTS "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "isDangerous" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");
CREATE INDEX IF NOT EXISTS "Permission_module_idx" ON "Permission"("module");
CREATE INDEX IF NOT EXISTS "Permission_action_idx" ON "Permission"("action");

-- Seed the permission catalog (idempotent — only inserts if key doesn't exist)
INSERT INTO "Permission" ("id", "key", "module", "action", "description", "isDangerous") VALUES
    -- Employee
    ('perm_employee_view', 'employee:view', 'employee', 'view', 'View employee directory', false),
    ('perm_employee_create', 'employee:create', 'employee', 'create', 'Create new employee records', false),
    ('perm_employee_update', 'employee:update', 'employee', 'edit', 'Update employee records', false),
    ('perm_employee_delete', 'employee:delete', 'employee', 'delete', 'Delete/offboard employees', true),
    ('perm_employee_view_self', 'employee:view:self', 'employee', 'view', 'View own employee profile', false),
    ('perm_employee_update_self', 'employee:update:self', 'employee', 'edit', 'Update own profile', false),
    ('perm_employee_view_team', 'employee:view:team', 'employee', 'view', 'View direct reportees', false),
    -- Leave
    ('perm_leave_view', 'leave:view', 'leave', 'view', 'View all leave applications', false),
    ('perm_leave_apply', 'leave:apply', 'leave', 'create', 'Apply for leave on behalf of others', false),
    ('perm_leave_approve', 'leave:approve', 'leave', 'approve', 'Approve/reject leave applications', false),
    ('perm_leave_apply_self', 'leave:apply:self', 'leave', 'create', 'Apply for own leave', false),
    ('perm_leave_view_self', 'leave:view:self', 'leave', 'view', 'View own leave history', false),
    ('perm_leave_approve_team', 'leave:approve:team', 'leave', 'approve', 'Approve leave for direct reportees', false),
    -- Attendance
    ('perm_attendance_view', 'attendance:view', 'attendance', 'view', 'View all attendance records', false),
    ('perm_attendance_mark', 'attendance:mark', 'attendance', 'create', 'Manual attendance entry', false),
    ('perm_attendance_mark_self', 'attendance:mark:self', 'attendance', 'create', 'Self check-in/check-out', false),
    ('perm_attendance_view_self', 'attendance:view:self', 'attendance', 'view', 'View own attendance', false),
    ('perm_attendance_view_team', 'attendance:view:team', 'attendance', 'view', 'View team attendance', false),
    -- Payroll
    ('perm_payroll_view', 'payroll:view', 'payroll', 'view', 'View payroll records', false),
    ('perm_payroll_process', 'payroll:process', 'payroll', 'process', 'Run payroll processing', true),
    ('perm_payroll_approve', 'payroll:approve', 'payroll', 'approve', 'Approve salary slips', false),
    ('perm_payslip_view_self', 'payslip:view:self', 'payroll', 'view', 'View own payslips', false),
    -- Recruitment
    ('perm_recruitment_view', 'recruitment:view', 'recruitment', 'view', 'View job postings', false),
    ('perm_recruitment_manage', 'recruitment:manage', 'recruitment', 'edit', 'Manage job postings and candidates', false),
    -- Performance
    ('perm_performance_view', 'performance:view', 'performance', 'view', 'View all performance data', false),
    ('perm_performance_manage', 'performance:manage', 'performance', 'edit', 'Manage review cycles and goals', false),
    ('perm_performance_view_self', 'performance:view:self', 'performance', 'view', 'View own performance', false),
    ('perm_performance_review_team', 'performance:review:team', 'performance', 'approve', 'Review team performance', false),
    -- Expense
    ('perm_expense_submit', 'expense:submit', 'expense', 'create', 'Submit expense claims', false),
    ('perm_expense_approve', 'expense:approve', 'expense', 'approve', 'Approve expense claims (org-wide)', false),
    ('perm_expense_approve_team', 'expense:approve:team', 'expense', 'approve', 'Approve team expense claims', false),
    ('perm_expense_view_self', 'expense:view:self', 'expense', 'view', 'View own expense claims', false),
    -- Settings & Admin
    ('perm_settings_view', 'settings:view', 'settings', 'view', 'View organization settings', false),
    ('perm_settings_manage', 'settings:manage', 'settings', 'edit', 'Manage organization settings', false),
    ('perm_reports_view', 'reports:view', 'reports', 'view', 'View reports', false),
    ('perm_reports_export', 'reports:export', 'reports', 'view', 'Export reports (CSV/Excel/PDF)', false),
    -- RBAC (new — for managing roles themselves)
    ('perm_rbac_roles_view', 'rbac:roles:view', 'rbac', 'view', 'View roles and permissions', false),
    ('perm_rbac_roles_manage', 'rbac:roles:manage', 'rbac', 'edit', 'Create and edit custom roles', true),
    ('perm_rbac_audit_view', 'rbac:audit:view', 'rbac', 'view', 'View RBAC audit log', false)
ON CONFLICT ("key") DO NOTHING;

-- ── 2. Role ──
CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "dashboardConfig" JSONB,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Role_organizationId_slug_key" ON "Role"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "Role_organizationId_idx" ON "Role"("organizationId");
CREATE INDEX IF NOT EXISTS "Role_isSystem_idx" ON "Role"("isSystem");

ALTER TABLE "Role"
    ADD CONSTRAINT "Role_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE;

-- Seed 5 system roles (organizationId = NULL = global)
INSERT INTO "Role" ("id", "name", "slug", "description", "isSystem", "isDefault", "sortOrder", "color") VALUES
    ('role_super_admin', 'Super Admin', 'super_admin', 'Full system access — cannot be restricted', true, false, 1, '#ef4444'),
    ('role_admin', 'Admin', 'admin', 'Organization administrator with full HR access', true, false, 2, '#a855f7'),
    ('role_hr_admin', 'HR Admin', 'hr_admin', 'HR operations manager', true, false, 3, '#3b82f6'),
    ('role_manager', 'Manager', 'manager', 'Team manager with reportee access', true, false, 4, '#10b981'),
    ('role_employee', 'Employee', 'employee', 'Self-service employee (default)', true, true, 5, '#6b7280')
ON CONFLICT DO NOTHING;

-- ── 3. RolePermission ──
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "departmentIds" JSONB,
    "branchIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_permissionId_scope_key"
    ON "RolePermission"("roleId", "permissionId", "scope");
CREATE INDEX IF NOT EXISTS "RolePermission_roleId_idx" ON "RolePermission"("roleId");
CREATE INDEX IF NOT EXISTS "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

ALTER TABLE "RolePermission"
    ADD CONSTRAINT "RolePermission_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id")
    ON DELETE CASCADE;

ALTER TABLE "RolePermission"
    ADD CONSTRAINT "RolePermission_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "Permission"("id")
    ON DELETE RESTRICT;

-- ── 4. UserRoleAssignment ──
CREATE TABLE IF NOT EXISTS "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleAssignment_userId_roleId_key"
    ON "UserRoleAssignment"("userId", "roleId");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_organizationId_idx" ON "UserRoleAssignment"("organizationId");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_expiresAt_idx" ON "UserRoleAssignment"("expiresAt");

ALTER TABLE "UserRoleAssignment"
    ADD CONSTRAINT "UserRoleAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE;

ALTER TABLE "UserRoleAssignment"
    ADD CONSTRAINT "UserRoleAssignment_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id")
    ON DELETE CASCADE;

ALTER TABLE "UserRoleAssignment"
    ADD CONSTRAINT "UserRoleAssignment_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE;

-- ── RLS on new tables ──
-- Role: organizationId is nullable (system roles are global). Policy:
--   bypass OR organizationId IS NULL OR matches tenant context.
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;

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

-- RolePermission: scoped through Role. We allow if the Role is system
-- (organizationId IS NULL) OR belongs to tenant.
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "RolePermission" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR EXISTS (
        SELECT 1 FROM "Role" r
        WHERE r.id = "RolePermission"."roleId"
        AND (r."organizationId" IS NULL OR r."organizationId" = current_setting('app.current_tenant_id', true))
    )
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR EXISTS (
        SELECT 1 FROM "Role" r
        WHERE r.id = "RolePermission"."roleId"
        AND (r."organizationId" IS NULL OR r."organizationId" = current_setting('app.current_tenant_id', true))
    )
);

-- UserRoleAssignment: organizationId is required.
ALTER TABLE "UserRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRoleAssignment" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "UserRoleAssignment" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
);

-- Permission is a global system catalog (no organizationId). No RLS needed
-- — it's read-only reference data that all tenants share.
