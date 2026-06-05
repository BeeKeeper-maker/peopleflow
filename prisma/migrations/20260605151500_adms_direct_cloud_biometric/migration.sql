-- PeopleFlow ADMS/iClock direct-cloud biometric support
-- Adds tenant-bound direct-cloud device metadata and safe payload capture.

ALTER TABLE "BiometricDevice"
  ADD COLUMN "connectionMode" TEXT NOT NULL DEFAULT 'sync_agent',
  ADD COLUMN "cloudProtocol" TEXT,
  ADD COLUMN "cloudStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "firmwareVersion" TEXT,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  ADD COLUMN "setupNotes" TEXT;

CREATE UNIQUE INDEX "BiometricDevice_organizationId_serialNumber_key"
  ON "BiometricDevice"("organizationId", "serialNumber")
  WHERE "serialNumber" IS NOT NULL;

CREATE INDEX "BiometricDevice_connectionMode_idx" ON "BiometricDevice"("connectionMode");
CREATE INDEX "BiometricDevice_cloudStatus_idx" ON "BiometricDevice"("cloudStatus");
CREATE INDEX "BiometricDevice_lastSeenAt_idx" ON "BiometricDevice"("lastSeenAt");

CREATE TABLE "BiometricCloudEvent" (
  "id" TEXT NOT NULL,
  "serialNumber" TEXT,
  "eventType" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "query" JSONB NOT NULL DEFAULT '{}',
  "headers" JSONB NOT NULL DEFAULT '{}',
  "body" TEXT,
  "status" TEXT NOT NULL DEFAULT 'captured',
  "recordsReceived" INTEGER NOT NULL DEFAULT 0,
  "recordsSynced" INTEGER NOT NULL DEFAULT 0,
  "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
  "unmappedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "errorMessage" TEXT,
  "remoteIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT,
  "deviceId" TEXT,

  CONSTRAINT "BiometricCloudEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BiometricCloudEvent_serialNumber_idx" ON "BiometricCloudEvent"("serialNumber");
CREATE INDEX "BiometricCloudEvent_eventType_idx" ON "BiometricCloudEvent"("eventType");
CREATE INDEX "BiometricCloudEvent_status_idx" ON "BiometricCloudEvent"("status");
CREATE INDEX "BiometricCloudEvent_createdAt_idx" ON "BiometricCloudEvent"("createdAt");
CREATE INDEX "BiometricCloudEvent_organizationId_idx" ON "BiometricCloudEvent"("organizationId");
CREATE INDEX "BiometricCloudEvent_deviceId_idx" ON "BiometricCloudEvent"("deviceId");

ALTER TABLE "BiometricCloudEvent"
  ADD CONSTRAINT "BiometricCloudEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BiometricCloudEvent"
  ADD CONSTRAINT "BiometricCloudEvent_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
