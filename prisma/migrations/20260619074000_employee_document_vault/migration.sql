-- Employee Document Vault metadata
-- Additive migration: preserves existing EmployeeDocument rows and enables searchable HR document management.

ALTER TABLE "EmployeeDocument"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN "originalName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "issueDate" TIMESTAMP(3),
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "uploadedById" TEXT,
  ADD COLUMN "verifiedById" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedReason" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "EmployeeDocument"
SET "status" = CASE WHEN "isVerified" THEN 'verified' ELSE 'pending' END
WHERE "status" = 'pending';

CREATE INDEX "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");
CREATE INDEX "EmployeeDocument_category_idx" ON "EmployeeDocument"("category");
CREATE INDEX "EmployeeDocument_status_idx" ON "EmployeeDocument"("status");
CREATE INDEX "EmployeeDocument_expiryDate_idx" ON "EmployeeDocument"("expiryDate");
CREATE INDEX "EmployeeDocument_deletedAt_idx" ON "EmployeeDocument"("deletedAt");
