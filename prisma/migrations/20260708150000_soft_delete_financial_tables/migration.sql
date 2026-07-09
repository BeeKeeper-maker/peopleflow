-- ═══════════════════════════════════════════════════════════════════
-- Soft Delete for Financial Tables (BLA 2006 Compliance)
-- ═══════════════════════════════════════════════════════════════════
-- Adds deletedAt column to 6 financial tables for 12-year retention.
-- Soft-delete preserves records for audit while hiding them from UI.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "SalaryStructureAssignment" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "SalaryDisbursement" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "LoanRepayment" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "FestivalBonusPayment" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "PFAccount" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "PFTransaction" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Indexes for soft-delete queries (WHERE deletedAt IS NULL)
CREATE INDEX "SalaryStructureAssignment_deletedAt_idx" ON "SalaryStructureAssignment"("deletedAt");
CREATE INDEX "SalaryDisbursement_deletedAt_idx" ON "SalaryDisbursement"("deletedAt");
CREATE INDEX "LoanRepayment_deletedAt_idx" ON "LoanRepayment"("deletedAt");
CREATE INDEX "FestivalBonusPayment_deletedAt_idx" ON "FestivalBonusPayment"("deletedAt");
CREATE INDEX "PFAccount_deletedAt_idx" ON "PFAccount"("deletedAt");
CREATE INDEX "PFTransaction_deletedAt_idx" ON "PFTransaction"("deletedAt");
