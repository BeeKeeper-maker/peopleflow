-- ═══════════════════════════════════════════════════════════════════
-- Make denormalized organizationId columns NOT NULL
-- ═══════════════════════════════════════════════════════════════════
-- These columns were added as nullable for backfill, but the
-- backfill is complete. Nullable organizationId is a silent data
-- loss risk — if any insert omits it, RLS hides the row from
-- EVERYONE including the owning tenant.
-- ═══════════════════════════════════════════════════════════════════

-- First, backfill any NULL values from parent tables (safety net)
UPDATE "Attendance" a SET "organizationId" = e."organizationId"
FROM "Employee" e WHERE a."employeeId" = e."id" AND a."organizationId" IS NULL;

UPDATE "LeaveApplication" la SET "organizationId" = e."organizationId"
FROM "Employee" e WHERE la."employeeId" = e."id" AND la."organizationId" IS NULL;

UPDATE "LeaveAllocation" la SET "organizationId" = e."organizationId"
FROM "Employee" e WHERE la."employeeId" = e."id" AND la."organizationId" IS NULL;

UPDATE "SalarySlip" ss SET "organizationId" = e."organizationId"
FROM "Employee" e WHERE ss."employeeId" = e."id" AND ss."organizationId" IS NULL;

UPDATE "SalaryStructureAssignment" ssa SET "organizationId" = e."organizationId"
FROM "Employee" e WHERE ssa."employeeId" = e."id" AND ssa."organizationId" IS NULL;

UPDATE "Loan" l SET "organizationId" = e."organizationId"
FROM "Employee" e WHERE l."employeeId" = e."id" AND l."organizationId" IS NULL;

UPDATE "FestivalBonusPayment" fbp SET "organizationId" = e."organizationId"
FROM "Employee" e WHERE fbp."employeeId" = e."id" AND fbp."organizationId" IS NULL;

UPDATE "PFTransaction" pft SET "organizationId" = pfa."organizationId"
FROM "PFAccount" pfa WHERE pft."pfAccountId" = pfa."id" AND pft."organizationId" IS NULL;

UPDATE "PFAccount" pfa SET "organizationId" = e."organizationId"
FROM "Employee" e WHERE pfa."employeeId" = e."id" AND pfa."organizationId" IS NULL;

UPDATE "EmployeeDocument" ed SET "organizationId" = e."organizationId"
FROM "Employee" e WHERE ed."employeeId" = e."id" AND ed."organizationId" IS NULL;

-- Now set NOT NULL
ALTER TABLE "Attendance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveApplication" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveAllocation" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalarySlip" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalaryStructureAssignment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Loan" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FestivalBonusPayment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PFTransaction" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PFAccount" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeDocument" ALTER COLUMN "organizationId" SET NOT NULL;
