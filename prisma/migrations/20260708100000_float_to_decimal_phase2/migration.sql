-- ═══════════════════════════════════════════════════════════════════
-- Float → Decimal Migration: Phase 2 (remaining monetary tables)
-- ═══════════════════════════════════════════════════════════════════
-- Migrates 37 remaining monetary Float columns across 11 tables to
-- Decimal for precision-correct BDT accounting.
--
-- Phase 1 (20260708000000_float_to_decimal_salary_slip) handled
-- SalarySlip (17 fields). This phase handles the rest:
--   Loan (6)              LoanRepayment (3)
--   PFAccount (5)         PFTransaction (2)
--   FestivalBonusPayment (4)
--   SalaryStructureAssignment (1)  SalaryDisbursement (1)
--   ExpenseClaim (4)      ExpenseCategory (4)
--   SalaryStructure (6)   ExchangeRate (1)
--
-- Decimal sizing rules:
--   DECIMAL(18,2) — monetary amounts in BDT (max 999,999,999,999,999.99)
--   DECIMAL(5,2)  — percentages (max 999.99%)
--   DECIMAL(5,4)  — pro-rata factors (max 9.9999, e.g. 0.5 half-year)
--   DECIMAL(18,6) — exchange rates (max precision for forex)
-- ═══════════════════════════════════════════════════════════════════

-- ── Loan (6 fields) ─────────────────────────────────────────────────
ALTER TABLE "Loan" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "Loan" ALTER COLUMN "interestRate" TYPE DECIMAL(5,2) USING ROUND("interestRate"::numeric, 2);
ALTER TABLE "Loan" ALTER COLUMN "emiAmount" TYPE DECIMAL(18,2) USING ROUND("emiAmount"::numeric, 2);
ALTER TABLE "Loan" ALTER COLUMN "disbursedAmount" TYPE DECIMAL(18,2) USING ROUND("disbursedAmount"::numeric, 2);
ALTER TABLE "Loan" ALTER COLUMN "paidAmount" TYPE DECIMAL(18,2) USING ROUND("paidAmount"::numeric, 2);
ALTER TABLE "Loan" ALTER COLUMN "remainingAmount" TYPE DECIMAL(18,2) USING ROUND("remainingAmount"::numeric, 2);

-- ── LoanRepayment (3 fields) ────────────────────────────────────────
ALTER TABLE "LoanRepayment" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "LoanRepayment" ALTER COLUMN "principalPart" TYPE DECIMAL(18,2) USING ROUND("principalPart"::numeric, 2);
ALTER TABLE "LoanRepayment" ALTER COLUMN "interestPart" TYPE DECIMAL(18,2) USING ROUND("interestPart"::numeric, 2);

-- ── PFAccount (5 fields) ────────────────────────────────────────────
ALTER TABLE "PFAccount" ALTER COLUMN "employeeBalance" TYPE DECIMAL(18,2) USING ROUND("employeeBalance"::numeric, 2);
ALTER TABLE "PFAccount" ALTER COLUMN "employerBalance" TYPE DECIMAL(18,2) USING ROUND("employerBalance"::numeric, 2);
ALTER TABLE "PFAccount" ALTER COLUMN "interestBalance" TYPE DECIMAL(18,2) USING ROUND("interestBalance"::numeric, 2);
ALTER TABLE "PFAccount" ALTER COLUMN "totalBalance" TYPE DECIMAL(18,2) USING ROUND("totalBalance"::numeric, 2);
ALTER TABLE "PFAccount" ALTER COLUMN "interestRate" TYPE DECIMAL(5,2) USING ROUND("interestRate"::numeric, 2);

-- ── PFTransaction (2 fields) ────────────────────────────────────────
ALTER TABLE "PFTransaction" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "PFTransaction" ALTER COLUMN "runningBalance" TYPE DECIMAL(18,2) USING ROUND("runningBalance"::numeric, 2);

-- ── FestivalBonusPayment (4 fields) ─────────────────────────────────
ALTER TABLE "FestivalBonusPayment" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "FestivalBonusPayment" ALTER COLUMN "basisAmount" TYPE DECIMAL(18,2) USING ROUND("basisAmount"::numeric, 2);
ALTER TABLE "FestivalBonusPayment" ALTER COLUMN "percentageApplied" TYPE DECIMAL(5,2) USING ROUND("percentageApplied"::numeric, 2);
ALTER TABLE "FestivalBonusPayment" ALTER COLUMN "proRataFactor" TYPE DECIMAL(5,4) USING ROUND("proRataFactor"::numeric, 4);

-- ── SalaryStructureAssignment (1 field) ─────────────────────────────
ALTER TABLE "SalaryStructureAssignment" ALTER COLUMN "grossSalary" TYPE DECIMAL(18,2) USING ROUND("grossSalary"::numeric, 2);

-- ── SalaryDisbursement (1 field) ────────────────────────────────────
ALTER TABLE "SalaryDisbursement" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);

-- ── ExpenseClaim (4 fields) ─────────────────────────────────────────
ALTER TABLE "ExpenseClaim" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "ExpenseClaim" ALTER COLUMN "exchangeRate" TYPE DECIMAL(18,6) USING ROUND("exchangeRate"::numeric, 6);
ALTER TABLE "ExpenseClaim" ALTER COLUMN "amountInBDT" TYPE DECIMAL(18,2) USING ROUND("amountInBDT"::numeric, 2);
ALTER TABLE "ExpenseClaim" ALTER COLUMN "perDiemRate" TYPE DECIMAL(18,2) USING ROUND("perDiemRate"::numeric, 2);

-- ── ExpenseCategory (4 fields) ──────────────────────────────────────
ALTER TABLE "ExpenseCategory" ALTER COLUMN "maxAmount" TYPE DECIMAL(18,2) USING ROUND("maxAmount"::numeric, 2);
ALTER TABLE "ExpenseCategory" ALTER COLUMN "monthlyLimit" TYPE DECIMAL(18,2) USING ROUND("monthlyLimit"::numeric, 2);
ALTER TABLE "ExpenseCategory" ALTER COLUMN "mileageRate" TYPE DECIMAL(18,2) USING ROUND("mileageRate"::numeric, 2);
ALTER TABLE "ExpenseCategory" ALTER COLUMN "perDiemRate" TYPE DECIMAL(18,2) USING ROUND("perDiemRate"::numeric, 2);

-- ── SalaryStructure (6 fields — percentages & fixed allowance) ──────
ALTER TABLE "SalaryStructure" ALTER COLUMN "basicPercentage" TYPE DECIMAL(5,2) USING ROUND("basicPercentage"::numeric, 2);
ALTER TABLE "SalaryStructure" ALTER COLUMN "houseRentPercent" TYPE DECIMAL(5,2) USING ROUND("houseRentPercent"::numeric, 2);
ALTER TABLE "SalaryStructure" ALTER COLUMN "medicalPercent" TYPE DECIMAL(5,2) USING ROUND("medicalPercent"::numeric, 2);
ALTER TABLE "SalaryStructure" ALTER COLUMN "conveyanceFixed" TYPE DECIMAL(18,2) USING ROUND("conveyanceFixed"::numeric, 2);
ALTER TABLE "SalaryStructure" ALTER COLUMN "pfEmployeePercent" TYPE DECIMAL(5,2) USING ROUND("pfEmployeePercent"::numeric, 2);
ALTER TABLE "SalaryStructure" ALTER COLUMN "pfEmployerPercent" TYPE DECIMAL(5,2) USING ROUND("pfEmployerPercent"::numeric, 2);

-- ── ExchangeRate (1 field) ──────────────────────────────────────────
ALTER TABLE "ExchangeRate" ALTER COLUMN "rate" TYPE DECIMAL(18,6) USING ROUND("rate"::numeric, 6);
