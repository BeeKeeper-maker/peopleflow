-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Multi-currency Expense + Mileage + Per-diem
-- ═══════════════════════════════════════════════════════════════════
--
-- Upgrades the expense module with:
--   1. Multi-currency support (exchangeRate, amountInBDT)
--   2. Mileage tracking (distance, distanceUnit, computed amount)
--   3. Per-diem tracking (perDiemDays, perDiemRate, computed amount)
--   4. Policy violation flags
--   5. ExchangeRate table for cached currency rates
--   6. ExpenseCategory: categoryType, mileageRate, perDiemRate fields
-- ═══════════════════════════════════════════════════════════════════

-- ── ExpenseCategory: new fields ──
ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "categoryType" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "mileageRate" DOUBLE PRECISION;
ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "perDiemRate" DOUBLE PRECISION;

-- ── ExpenseClaim: new fields ──
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "amountInBDT" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "distance" DOUBLE PRECISION;
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "distanceUnit" TEXT;
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "perDiemDays" DOUBLE PRECISION;
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "perDiemRate" DOUBLE PRECISION;
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "policyViolation" TEXT;
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "policyViolationType" TEXT;

-- Backfill amountInBDT for existing claims (all BDT, so exchangeRate=1, amountInBDT=amount)
UPDATE "ExpenseClaim" SET "amountInBDT" = "amount" WHERE "amountInBDT" = 0;

-- Index for currency filtering
CREATE INDEX IF NOT EXISTS "ExpenseClaim_currency_idx" ON "ExpenseClaim"("currency");

-- ── ExchangeRate table ──
CREATE TABLE IF NOT EXISTS "ExchangeRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'BDT',
    "quoteCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExchangeRate_baseCurrency_quoteCurrency_key"
    ON "ExchangeRate"("baseCurrency", "quoteCurrency");
CREATE INDEX IF NOT EXISTS "ExchangeRate_quoteCurrency_idx" ON "ExchangeRate"("quoteCurrency");
CREATE INDEX IF NOT EXISTS "ExchangeRate_fetchedAt_idx" ON "ExchangeRate"("fetchedAt");

-- Seed common exchange rates (approximate, will be refreshed by cron)
INSERT INTO "ExchangeRate" ("id", "baseCurrency", "quoteCurrency", "rate", "source") VALUES
    ('er_usd_bdt', 'BDT', 'USD', 117.0, 'seed'),
    ('er_eur_bdt', 'BDT', 'EUR', 126.5, 'seed'),
    ('er_gbp_bdt', 'BDT', 'GBP', 148.0, 'seed'),
    ('er_inr_bdt', 'BDT', 'INR', 1.40, 'seed'),
    ('er_aud_bdt', 'BDT', 'AUD', 76.5, 'seed'),
    ('er_cad_bdt', 'BDT', 'CAD', 85.0, 'seed'),
    ('er_sgd_bdt', 'BDT', 'SGD', 86.5, 'seed'),
    ('er_myb_bdt', 'BDT', 'MYR', 24.8, 'seed'),
    ('er_aed_bdt', 'BDT', 'AED', 31.8, 'seed'),
    ('er_sar_bdt', 'BDT', 'SAR', 31.2, 'seed'),
    ('er_pkr_bdt', 'BDT', 'PKR', 0.42, 'seed'),
    ('er_lkr_bdt', 'BDT', 'LKR', 0.39, 'seed'),
    ('er_npr_bdt', 'BDT', 'NPR', 0.88, 'seed'),
    ('er_btc_bdt', 'BDT', 'BTC', 1.0, 'seed')
ON CONFLICT ("baseCurrency", "quoteCurrency") DO NOTHING;

-- Remove the BTC seed (not relevant for expenses)
DELETE FROM "ExchangeRate" WHERE "quoteCurrency" = 'BTC';

-- RLS on ExchangeRate (global reference data, but still tenant-isolated
-- for writes — only platform admin can update rates)
ALTER TABLE "ExchangeRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExchangeRate" FORCE ROW LEVEL SECURITY;

-- ExchangeRate is read-only for tenant users; writes only via platform admin
CREATE POLICY tenant_isolation ON "ExchangeRate" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR true  -- rates are global reference data, readable by all tenants
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
);
