-- Phase 3: Final Float → Decimal migration
-- Completes the Float → Decimal migration for the last two Float columns
-- that were intentionally deferred in Phase 2 (see P5-FLOAT-DECIMAL-2 worklog).
--
--   1. FestivalBonusConfig.percentageOfBasis — percentage (0–999.99%)
--        DECIMAL(5,2) matches FestivalBonusPayment.percentageApplied
--        (already migrated in Phase 1) so the audit trail is consistent.
--
--   2. LateDeductionTier.deductionValue — polymorphic:
--        * fixed_amount       → BDT value (needs 18,2 for monetary precision)
--        * percentage_of_daily → % value (fits within 18,2 as well)
--        DECIMAL(18,2) covers both cases without losing precision on either.

ALTER TABLE "FestivalBonusConfig" ALTER COLUMN "percentageOfBasis" TYPE DECIMAL(5,2) USING ROUND("percentageOfBasis"::numeric, 2);
ALTER TABLE "LateDeductionTier" ALTER COLUMN "deductionValue" TYPE DECIMAL(18,2) USING ROUND("deductionValue"::numeric, 2);
