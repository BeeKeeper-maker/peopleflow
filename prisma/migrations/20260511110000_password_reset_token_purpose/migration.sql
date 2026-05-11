-- Distinguish true password resets from employee onboarding/reactivation invitations.
ALTER TABLE "PasswordResetToken"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'password_reset';

CREATE INDEX "PasswordResetToken_purpose_idx" ON "PasswordResetToken"("purpose");
