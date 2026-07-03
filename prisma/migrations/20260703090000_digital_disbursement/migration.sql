-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Digital Disbursement (bKash / Nagad / Bank)
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds SalaryDisbursement table for tracking salary payments via:
--   - bank_transfer: Traditional EFT (existing CSV bank file flow)
--   - bkash: bKash personal disbursement API
--   - nagad: Nagad disbursement API
--
-- Each disbursement is linked to a SalarySlip and tracks:
--   - Status: pending → processing → success / failed / refunded
--   - Provider reference (transaction ID from bKash/Nagad)
--   - Full provider response (JSON, for audit)
--   - Error message (if failed)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "SalaryDisbursement" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "providerResponse" JSONB,
    "errorMessage" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "salarySlipId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "SalaryDisbursement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalaryDisbursement_salarySlipId_idx" ON "SalaryDisbursement"("salarySlipId");
CREATE INDEX IF NOT EXISTS "SalaryDisbursement_employeeId_idx" ON "SalaryDisbursement"("employeeId");
CREATE INDEX IF NOT EXISTS "SalaryDisbursement_organizationId_idx" ON "SalaryDisbursement"("organizationId");
CREATE INDEX IF NOT EXISTS "SalaryDisbursement_status_idx" ON "SalaryDisbursement"("status");
CREATE INDEX IF NOT EXISTS "SalaryDisbursement_channel_idx" ON "SalaryDisbursement"("channel");

ALTER TABLE "SalaryDisbursement"
    ADD CONSTRAINT "SalaryDisbursement_salarySlipId_fkey"
    FOREIGN KEY ("salarySlipId") REFERENCES "SalarySlip"("id")
    ON DELETE CASCADE;

ALTER TABLE "SalaryDisbursement"
    ADD CONSTRAINT "SalaryDisbursement_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE;

ALTER TABLE "SalaryDisbursement"
    ADD CONSTRAINT "SalaryDisbursement_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE;

-- RLS
ALTER TABLE "SalaryDisbursement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalaryDisbursement" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "SalaryDisbursement" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR "organizationId" = current_setting('app.current_tenant_id', true)
);
