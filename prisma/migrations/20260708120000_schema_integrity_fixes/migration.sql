-- ═══════════════════════════════════════════════════════════════════
-- Schema Integrity Fixes: onDelete + Email Unique + Missing Indexes
-- Task ID: P5-SCHEMA-FIXES
--
-- Audit findings addressed:
--   1. 8 relations missing explicit onDelete (rely on Prisma defaults
--      which is opaque). Make them explicit so the schema is self-
--      documenting and survives `prisma migrate dev` re-snapshotting.
--   2. Employee.email has no unique constraint → duplicate emails
--      possible across the same organization.
--   3. 10 missing composite indexes for common query patterns
--      (payroll rollups, leave queues, audit pagination, etc.).
--
-- Idempotency:
--   - All DROP CONSTRAINT use IF EXISTS  → safe to re-run.
--   - All ADD CONSTRAINT use the canonical Prisma-generated names
--     (<Table>_<column>_fkey) so re-running matches what `prisma
--     migrate diff` would emit.
--   - All CREATE INDEX use IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1. Make onDelete explicit on 8 relations
-- ───────────────────────────────────────────────────────────────────

-- Employee.reportingManager → SetNull (allow manager deletion without blocking)
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_reportingManagerId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportingManagerId_fkey"
    FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Department.parent → SetNull (allow parent dept deletion, subtree becomes root)
ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_parentId_fkey";
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Department"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee.department → SetNull (allow dept deletion, employees unassigned)
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_departmentId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee.designation → SetNull
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_designationId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey"
    FOREIGN KEY ("designationId") REFERENCES "Designation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee.branch → SetNull
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_branchId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee.shift → SetNull
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_shiftId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- LeaveApplication.leaveType → Restrict (don't delete leave type with applications)
ALTER TABLE "LeaveApplication" DROP CONSTRAINT IF EXISTS "LeaveApplication_leaveTypeId_fkey";
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- BiometricDevice.branch → SetNull
ALTER TABLE "BiometricDevice" DROP CONSTRAINT IF EXISTS "BiometricDevice_branchId_fkey";
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────────────────────────────────────────────────────────────
-- 2. Employee email unique per organization (PARTIAL — only non-NULL)
--
--    PostgreSQL's standard UNIQUE allows multiple NULLs (NULLs are
--    considered distinct), so a non-partial index would also work.
--    We use a PARTIAL index because:
--      a) it's smaller (skips all rows where email IS NULL), and
--      b) it documents intent: "uniqueness applies only when email
--         is provided."
--
--    The index name follows Prisma's @@unique naming convention
--    (<Model>_<field1>_<field2>_key) so a future `prisma migrate diff`
--    sees this as the canonical constraint for @@unique([organizationId, email]).
-- ───────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_organizationId_email_key"
    ON "Employee"("organizationId", "email")
    WHERE "email" IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────
-- 3. Missing performance indexes
-- ───────────────────────────────────────────────────────────────────

-- SalarySlip: payroll run by period
CREATE INDEX IF NOT EXISTS "SalarySlip_organizationId_month_year_status_idx"
    ON "SalarySlip"("organizationId", "month", "year", "status");

-- Attendance: daily org-wide rollup
CREATE INDEX IF NOT EXISTS "Attendance_organizationId_date_idx"
    ON "Attendance"("organizationId", "date");

-- LeaveApplication: pending leave queue
CREATE INDEX IF NOT EXISTS "LeaveApplication_organizationId_status_fromDate_idx"
    ON "LeaveApplication"("organizationId", "status", "fromDate");

-- AuditLog: per-tenant audit pagination
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx"
    ON "AuditLog"("organizationId", "createdAt");

-- ApprovalRequest: approver's pending queue
CREATE INDEX IF NOT EXISTS "ApprovalRequest_organizationId_status_currentApproverId_idx"
    ON "ApprovalRequest"("organizationId", "status", "currentApproverId");

-- PFTransaction: PF ledger reports
CREATE INDEX IF NOT EXISTS "PFTransaction_organizationId_transactionDate_idx"
    ON "PFTransaction"("organizationId", "transactionDate");

-- ExpenseClaim: expense reports
CREATE INDEX IF NOT EXISTS "ExpenseClaim_organizationId_status_expenseDate_idx"
    ON "ExpenseClaim"("organizationId", "status", "expenseDate");

-- BiometricCloudEvent: device event time-series
CREATE INDEX IF NOT EXISTS "BiometricCloudEvent_serialNumber_createdAt_idx"
    ON "BiometricCloudEvent"("serialNumber", "createdAt");

-- Holiday: holiday lookup by date
CREATE INDEX IF NOT EXISTS "Holiday_holidayListId_date_idx"
    ON "Holiday"("holidayListId", "date");

-- Employee: directory listing with active filter + soft-delete
CREATE INDEX IF NOT EXISTS "Employee_organizationId_employmentStatus_deletedAt_idx"
    ON "Employee"("organizationId", "employmentStatus", "deletedAt");
