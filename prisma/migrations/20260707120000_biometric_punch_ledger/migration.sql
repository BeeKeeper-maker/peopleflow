-- ═══════════════════════════════════════════════════════════════════
-- Biometric Punch Ledger — Raw Punch Storage
-- ═══════════════════════════════════════════════════════════════════
--
-- Stores EVERY raw biometric punch as a separate row. This ensures
-- no punch is ever lost, even when:
--   - Punches arrive in separate sync batches (real-time sync)
--   - The same punch is re-synced (idempotent via unique constraint)
--   - Network interruptions cause partial batches
--
-- Attendance.checkIn/checkOut are DERIVED from this ledger:
--   checkIn  = MIN(BiometricPunch.punchTime) for (employee, shiftDate)
--   checkOut = MAX(BiometricPunch.punchTime) for (employee, shiftDate)
--
-- Break time is calculated from intermediate punches:
--   For 4 punches [09:00, 13:00, 14:00, 18:00]:
--     break = (14:00 - 13:00) = 60 min lunch break
--     netWork = (18:00 - 09:00) - 60min = 8 hours
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE "BiometricPunch" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "punchType" INTEGER,
    "deviceId" TEXT,
    "deviceSerial" TEXT,
    "source" TEXT NOT NULL DEFAULT 'biometric',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricPunch_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: prevent duplicate punch ingestion (idempotent re-sync)
CREATE UNIQUE INDEX "BiometricPunch_employeeId_punchTime_key" ON "BiometricPunch"("employeeId", "punchTime");

-- Performance indexes
CREATE INDEX "BiometricPunch_employeeId_shiftDate_idx" ON "BiometricPunch"("employeeId", "shiftDate");
CREATE INDEX "BiometricPunch_shiftDate_idx" ON "BiometricPunch"("shiftDate");
CREATE INDEX "BiometricPunch_organizationId_idx" ON "BiometricPunch"("organizationId");
CREATE INDEX "BiometricPunch_deviceId_idx" ON "BiometricPunch"("deviceId");

-- Foreign keys
ALTER TABLE "BiometricPunch"
    ADD CONSTRAINT "BiometricPunch_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BiometricPunch"
    ADD CONSTRAINT "BiometricPunch_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
-- RLS: Enable Row-Level Security for tenant isolation
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "BiometricPunch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BiometricPunch" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "BiometricPunch" FOR ALL
    USING (organizationId = current_setting('app.current_tenant_id', true))
    WITH CHECK (organizationId = current_setting('app.current_tenant_id', true));
