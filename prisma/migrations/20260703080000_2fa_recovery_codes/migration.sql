-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — 2FA Recovery Codes
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds recovery codes for 2FA:
--   - twoFactorRecoveryCodes: array of bcrypt-hashed codes
--   - twoFactorRecoveryCodesGeneratedAt: when codes were generated
--
-- When a user enables 2FA, 10 recovery codes are generated.
-- Each code is 16 characters, format: XXXX-XXXX-XXXX-XXXX
-- Codes are hashed with bcrypt before storage (shown in plaintext ONCE).
-- Each code is single-use (removed from array after use).
-- User can regenerate codes at any time (invalidates all old codes).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorRecoveryCodesGeneratedAt" TIMESTAMP(3);
