-- Add per-user session version for JWT invalidation after password/security changes
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
