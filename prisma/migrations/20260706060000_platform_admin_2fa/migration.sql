-- AlterTable: Add 2FA fields to PlatformAdmin
ALTER TABLE "PlatformAdmin" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformAdmin" ADD COLUMN "twoFactorSecret" TEXT;
