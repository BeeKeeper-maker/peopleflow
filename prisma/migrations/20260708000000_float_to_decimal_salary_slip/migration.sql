-- ═══════════════════════════════════════════════════════════════════
-- Float → Decimal Migration: SalarySlip (Phase 1)
-- ═══════════════════════════════════════════════════════════════════
-- Migrates 17 monetary Float columns to Decimal(18,2) for precision.
-- Float64 cannot accurately represent BDT amounts — rounding errors
-- accumulate across PF, tax, and net salary calculations.
--
-- Decimal(18,2) supports up to 999,999,999,999,999.99 — more than
-- sufficient for any salary amount in BDT.
-- ═══════════════════════════════════════════════════════════════════

-- Earnings
ALTER TABLE "SalarySlip" ALTER COLUMN "basicSalary" TYPE DECIMAL(18,2) USING ROUND("basicSalary"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "houseRent" TYPE DECIMAL(18,2) USING ROUND("houseRent"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "medicalAllowance" TYPE DECIMAL(18,2) USING ROUND("medicalAllowance"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "conveyance" TYPE DECIMAL(18,2) USING ROUND("conveyance"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "specialAllowance" TYPE DECIMAL(18,2) USING ROUND("specialAllowance"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "overtime" TYPE DECIMAL(18,2) USING ROUND("overtime"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "bonus" TYPE DECIMAL(18,2) USING ROUND("bonus"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "festivalBonus" TYPE DECIMAL(18,2) USING ROUND("festivalBonus"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "arrears" TYPE DECIMAL(18,2) USING ROUND("arrears"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "otherEarnings" TYPE DECIMAL(18,2) USING ROUND("otherEarnings"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "grossSalary" TYPE DECIMAL(18,2) USING ROUND("grossSalary"::numeric, 2);

-- Deductions
ALTER TABLE "SalarySlip" ALTER COLUMN "pfEmployee" TYPE DECIMAL(18,2) USING ROUND("pfEmployee"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "incomeTax" TYPE DECIMAL(18,2) USING ROUND("incomeTax"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "loanDeduction" TYPE DECIMAL(18,2) USING ROUND("loanDeduction"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "advanceDeduction" TYPE DECIMAL(18,2) USING ROUND("advanceDeduction"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "absentDeduction" TYPE DECIMAL(18,2) USING ROUND("absentDeduction"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "lateDeduction" TYPE DECIMAL(18,2) USING ROUND("lateDeduction"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "otherDeductions" TYPE DECIMAL(18,2) USING ROUND("otherDeductions"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "totalDeductions" TYPE DECIMAL(18,2) USING ROUND("totalDeductions"::numeric, 2);

-- Net
ALTER TABLE "SalarySlip" ALTER COLUMN "pfEmployer" TYPE DECIMAL(18,2) USING ROUND("pfEmployer"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "netSalary" TYPE DECIMAL(18,2) USING ROUND("netSalary"::numeric, 2);

-- Day counts (Decimal(6,2) — max 9999.99 days)
ALTER TABLE "SalarySlip" ALTER COLUMN "totalWorkingDays" TYPE DECIMAL(6,2) USING ROUND("totalWorkingDays"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "presentDays" TYPE DECIMAL(6,2) USING ROUND("presentDays"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "absentDays" TYPE DECIMAL(6,2) USING ROUND("absentDays"::numeric, 2);
ALTER TABLE "SalarySlip" ALTER COLUMN "leaveDays" TYPE DECIMAL(6,2) USING ROUND("leaveDays"::numeric, 2);
