-- ═══════════════════════════════════════════════════════════════════
-- Soft Delete Expansion Migration
-- ═══════════════════════════════════════════════════════════════════
-- BLA 2006 requires payroll records kept 12 years, audit logs 3 years.
-- Hard deletes make this impossible to enforce. Adding deletedAt to
-- critical models enables soft-delete pattern.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "LeaveApplication" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AuditLog should NEVER be deleted (even softly) — it's immutable.
-- No deletedAt for AuditLog per BLA 2006 compliance.

-- Indexes for soft-delete queries (WHERE deletedAt IS NULL)
CREATE INDEX IF NOT EXISTS "SalarySlip_deletedAt_idx" ON "SalarySlip"("deletedAt");
CREATE INDEX IF NOT EXISTS "LeaveApplication_deletedAt_idx" ON "LeaveApplication"("deletedAt");
CREATE INDEX IF NOT EXISTS "Loan_deletedAt_idx" ON "Loan"("deletedAt");
CREATE INDEX IF NOT EXISTS "Attendance_deletedAt_idx" ON "Attendance"("deletedAt");
CREATE INDEX IF NOT EXISTS "Notification_deletedAt_idx" ON "Notification"("deletedAt");
