-- ═══════════════════════════════════════════════════════════════════
-- BD-Specific Fields Migration
-- ═══════════════════════════════════════════════════════════════════
-- Adds Bangladesh-specific fields to Employee and Organization models.
-- These fields are required for:
-- - BLA 2006 compliance (religion for festival bonus, childrenCount for maternity)
-- - BD tax exemptions (isSeniorCitizen, isDisabled, isFreedomFighter)
-- - Digital payroll disbursement (bkashNumber, nagadNumber)
-- - BD regulatory compliance (BIN, TIN, VAT, trade license)
-- ═══════════════════════════════════════════════════════════════════

-- ── Employee: BD Personal Info ──
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "firstNameBn" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastNameBn" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "religion" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "fatherName" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "fatherNameBn" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "motherName" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "motherNameBn" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "spouseName" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "childrenCount" INTEGER;

-- ── Employee: BD Mobile Banking ──
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bkashNumber" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "nagadNumber" TEXT;

-- ── Employee: Tax Exemption Flags ──
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "isSeniorCitizen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "isDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "isFreedomFighter" BOOLEAN NOT NULL DEFAULT false;

-- ── Organization: BD Compliance Fields ──
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "binNumber" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "tinNumber" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "vatNumber" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "tradeLicenseNumber" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "tradeLicenseExpiry" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "binExpiry" TIMESTAMP(3);

-- ── Indexes for new fields ──
CREATE INDEX IF NOT EXISTS "Employee_religion_idx" ON "Employee"("religion");
CREATE INDEX IF NOT EXISTS "Employee_isSeniorCitizen_idx" ON "Employee"("isSeniorCitizen");
CREATE INDEX IF NOT EXISTS "Employee_isDisabled_idx" ON "Employee"("isDisabled");
CREATE INDEX IF NOT EXISTS "Employee_isFreedomFighter_idx" ON "Employee"("isFreedomFighter");
