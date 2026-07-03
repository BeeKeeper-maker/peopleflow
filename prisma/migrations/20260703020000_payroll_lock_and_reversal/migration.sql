-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Payroll Lock & Reversal
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds lock and reversal fields to SalarySlip so that:
--   1. Paid slips can be LOCKED to prevent accidental re-processing
--   2. Incorrect paid slips can be REVERSED (not deleted) for audit trail
--
-- Previously, the payroll process endpoint would silently skip existing
-- slips ("Slip already exists"). There was no lock, no reversal, no way
-- to correct a mistake without direct DB access.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "lockedById" TEXT;
ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "lockedReason" TEXT;
ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "isReversed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;
ALTER TABLE "SalarySlip" ADD COLUMN IF NOT EXISTS "reversedReason" TEXT;

-- Index for finding locked/reversed slips quickly
CREATE INDEX IF NOT EXISTS "SalarySlip_isLocked_idx" ON "SalarySlip"("isLocked");
CREATE INDEX IF NOT EXISTS "SalarySlip_isReversed_idx" ON "SalarySlip"("isReversed");
