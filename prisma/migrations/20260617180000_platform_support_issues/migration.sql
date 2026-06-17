-- Add platform-owned support issue log for tenant health/support workflow.
-- Additive only: no existing data is modified.
CREATE TABLE "PlatformSupportIssue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'bug',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "scope" TEXT NOT NULL DEFAULT 'core_hrms',
    "source" TEXT NOT NULL DEFAULT 'platform',
    "impact" TEXT,
    "nextAction" TEXT,
    "resolution" TEXT,
    "metadata" JSONB,
    "dueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "reportedById" TEXT,

    CONSTRAINT "PlatformSupportIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformSupportIssue_organizationId_idx" ON "PlatformSupportIssue"("organizationId");
CREATE INDEX "PlatformSupportIssue_status_idx" ON "PlatformSupportIssue"("status");
CREATE INDEX "PlatformSupportIssue_priority_idx" ON "PlatformSupportIssue"("priority");
CREATE INDEX "PlatformSupportIssue_category_idx" ON "PlatformSupportIssue"("category");
CREATE INDEX "PlatformSupportIssue_scope_idx" ON "PlatformSupportIssue"("scope");
CREATE INDEX "PlatformSupportIssue_assignedToId_idx" ON "PlatformSupportIssue"("assignedToId");
CREATE INDEX "PlatformSupportIssue_createdAt_idx" ON "PlatformSupportIssue"("createdAt");

ALTER TABLE "PlatformSupportIssue" ADD CONSTRAINT "PlatformSupportIssue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformSupportIssue" ADD CONSTRAINT "PlatformSupportIssue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformSupportIssue" ADD CONSTRAINT "PlatformSupportIssue_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
