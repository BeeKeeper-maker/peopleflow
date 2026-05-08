-- Allow payroll to represent real half-day attendance/leave accurately.
-- Payroll amounts are already Float; day counts must also allow 0.5 for half-day workflows.
ALTER TABLE "SalarySlip"
  ALTER COLUMN "totalWorkingDays" TYPE DOUBLE PRECISION USING "totalWorkingDays"::double precision,
  ALTER COLUMN "presentDays" TYPE DOUBLE PRECISION USING "presentDays"::double precision,
  ALTER COLUMN "absentDays" TYPE DOUBLE PRECISION USING "absentDays"::double precision,
  ALTER COLUMN "leaveDays" TYPE DOUBLE PRECISION USING "leaveDays"::double precision;
