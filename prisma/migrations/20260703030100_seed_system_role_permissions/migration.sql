-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Seed RolePermission for 5 system roles
-- ═══════════════════════════════════════════════════════════════════
--
-- Maps each system role to its permissions (mirroring the legacy
-- ROLE_PERMISSIONS map in src/lib/permissions.ts).
--
-- super_admin: NOT seeded here — gets "*" wildcard via application logic.
--   (The wildcard is checked in hasEffectivePermission, not stored in DB.)
--
-- This migration is idempotent (ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════════

-- Helper: insert a RolePermission if it doesn't exist
-- We use ON CONFLICT DO NOTHING on the (roleId, permissionId, scope) unique index.

-- ── admin role: full HR access (no self-only perms — admin has org-wide) ──
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "scope") VALUES
    ('rp_admin_employee_view', 'role_admin', 'perm_employee_view', 'global'),
    ('rp_admin_employee_create', 'role_admin', 'perm_employee_create', 'global'),
    ('rp_admin_employee_update', 'role_admin', 'perm_employee_update', 'global'),
    ('rp_admin_employee_delete', 'role_admin', 'perm_employee_delete', 'global'),
    ('rp_admin_leave_view', 'role_admin', 'perm_leave_view', 'global'),
    ('rp_admin_leave_approve', 'role_admin', 'perm_leave_approve', 'global'),
    ('rp_admin_attendance_view', 'role_admin', 'perm_attendance_view', 'global'),
    ('rp_admin_attendance_mark', 'role_admin', 'perm_attendance_mark', 'global'),
    ('rp_admin_payroll_view', 'role_admin', 'perm_payroll_view', 'global'),
    ('rp_admin_payroll_process', 'role_admin', 'perm_payroll_process', 'global'),
    ('rp_admin_payroll_approve', 'role_admin', 'perm_payroll_approve', 'global'),
    ('rp_admin_recruitment_view', 'role_admin', 'perm_recruitment_view', 'global'),
    ('rp_admin_recruitment_manage', 'role_admin', 'perm_recruitment_manage', 'global'),
    ('rp_admin_performance_view', 'role_admin', 'perm_performance_view', 'global'),
    ('rp_admin_performance_manage', 'role_admin', 'perm_performance_manage', 'global'),
    ('rp_admin_expense_approve', 'role_admin', 'perm_expense_approve', 'global'),
    ('rp_admin_settings_view', 'role_admin', 'perm_settings_view', 'global'),
    ('rp_admin_settings_manage', 'role_admin', 'perm_settings_manage', 'global'),
    ('rp_admin_reports_view', 'role_admin', 'perm_reports_view', 'global'),
    ('rp_admin_reports_export', 'role_admin', 'perm_reports_export', 'global'),
    ('rp_admin_rbac_roles_view', 'role_admin', 'perm_rbac_roles_view', 'global'),
    ('rp_admin_rbac_roles_manage', 'role_admin', 'perm_rbac_roles_manage', 'global')
ON CONFLICT ("roleId", "permissionId", "scope") DO NOTHING;

-- ── hr_admin role: HR operations (no delete, no settings_manage) ──
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "scope") VALUES
    ('rp_hr_employee_view', 'role_hr_admin', 'perm_employee_view', 'global'),
    ('rp_hr_employee_create', 'role_hr_admin', 'perm_employee_create', 'global'),
    ('rp_hr_employee_update', 'role_hr_admin', 'perm_employee_update', 'global'),
    ('rp_hr_leave_view', 'role_hr_admin', 'perm_leave_view', 'global'),
    ('rp_hr_leave_approve', 'role_hr_admin', 'perm_leave_approve', 'global'),
    ('rp_hr_attendance_view', 'role_hr_admin', 'perm_attendance_view', 'global'),
    ('rp_hr_attendance_mark', 'role_hr_admin', 'perm_attendance_mark', 'global'),
    ('rp_hr_payroll_view', 'role_hr_admin', 'perm_payroll_view', 'global'),
    ('rp_hr_payroll_process', 'role_hr_admin', 'perm_payroll_process', 'global'),
    ('rp_hr_recruitment_view', 'role_hr_admin', 'perm_recruitment_view', 'global'),
    ('rp_hr_recruitment_manage', 'role_hr_admin', 'perm_recruitment_manage', 'global'),
    ('rp_hr_performance_view', 'role_hr_admin', 'perm_performance_view', 'global'),
    ('rp_hr_performance_manage', 'role_hr_admin', 'perm_performance_manage', 'global'),
    ('rp_hr_reports_view', 'role_hr_admin', 'perm_reports_view', 'global'),
    ('rp_hr_reports_export', 'role_hr_admin', 'perm_reports_export', 'global'),
    ('rp_hr_rbac_roles_view', 'role_hr_admin', 'perm_rbac_roles_view', 'global')
ON CONFLICT ("roleId", "permissionId", "scope") DO NOTHING;

-- ── manager role: self + team scoping ──
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "scope") VALUES
    -- Self
    ('rp_mgr_employee_view_self', 'role_manager', 'perm_employee_view_self', 'self'),
    ('rp_mgr_employee_update_self', 'role_manager', 'perm_employee_update_self', 'self'),
    ('rp_mgr_leave_apply_self', 'role_manager', 'perm_leave_apply_self', 'self'),
    ('rp_mgr_leave_view_self', 'role_manager', 'perm_leave_view_self', 'self'),
    ('rp_mgr_attendance_mark_self', 'role_manager', 'perm_attendance_mark_self', 'self'),
    ('rp_mgr_attendance_view_self', 'role_manager', 'perm_attendance_view_self', 'self'),
    ('rp_mgr_payslip_view_self', 'role_manager', 'perm_payslip_view_self', 'self'),
    ('rp_mgr_performance_view_self', 'role_manager', 'perm_performance_view_self', 'self'),
    ('rp_mgr_expense_submit', 'role_manager', 'perm_expense_submit', 'self'),
    ('rp_mgr_expense_view_self', 'role_manager', 'perm_expense_view_self', 'self'),
    -- Team
    ('rp_mgr_employee_view_team', 'role_manager', 'perm_employee_view_team', 'team'),
    ('rp_mgr_leave_approve_team', 'role_manager', 'perm_leave_approve_team', 'team'),
    ('rp_mgr_attendance_view_team', 'role_manager', 'perm_attendance_view_team', 'team'),
    ('rp_mgr_performance_review_team', 'role_manager', 'perm_performance_review_team', 'team'),
    ('rp_mgr_expense_approve_team', 'role_manager', 'perm_expense_approve_team', 'team'),
    -- Reports
    ('rp_mgr_reports_view', 'role_manager', 'perm_reports_view', 'global')
ON CONFLICT ("roleId", "permissionId", "scope") DO NOTHING;

-- ── employee role: self-service only ──
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "scope") VALUES
    ('rp_emp_employee_view_self', 'role_employee', 'perm_employee_view_self', 'self'),
    ('rp_emp_employee_update_self', 'role_employee', 'perm_employee_update_self', 'self'),
    ('rp_emp_leave_apply_self', 'role_employee', 'perm_leave_apply_self', 'self'),
    ('rp_emp_leave_view_self', 'role_employee', 'perm_leave_view_self', 'self'),
    ('rp_emp_attendance_mark_self', 'role_employee', 'perm_attendance_mark_self', 'self'),
    ('rp_emp_attendance_view_self', 'role_employee', 'perm_attendance_view_self', 'self'),
    ('rp_emp_payslip_view_self', 'role_employee', 'perm_payslip_view_self', 'self'),
    ('rp_emp_performance_view_self', 'role_employee', 'perm_performance_view_self', 'self'),
    ('rp_emp_expense_submit', 'role_employee', 'perm_expense_submit', 'self'),
    ('rp_emp_expense_view_self', 'role_employee', 'perm_expense_view_self', 'self')
ON CONFLICT ("roleId", "permissionId", "scope") DO NOTHING;
