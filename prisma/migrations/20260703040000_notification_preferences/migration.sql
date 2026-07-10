-- ═══════════════════════════════════════════════════════════════════
-- PeopleFlow HRMS — Per-User Notification Preferences
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds NotificationPreference table for per-user control over:
--   - in_app, email, push channels (global toggles)
--   - Per-category overrides (leave, payroll, attendance, etc.)
--   - Digest mode (instant, daily, weekly)
--   - Quiet hours (no notifications during specified hours)
--   - Web push subscription endpoint
--
-- Also adds a composite index on Notification(userId, createdAt) for
-- faster "recent notifications" queries.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "digestMode" TEXT NOT NULL DEFAULT 'instant',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "categoryOverrides" JSONB,
    "pushSubscription" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key"
    ON "NotificationPreference"("userId");

ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE;

-- RLS: NotificationPreference is user-scoped (no organizationId, but
-- each row belongs to a single user). We can't do tenant isolation on
-- this table directly because there's no organizationId column.
-- Instead, we rely on the application to always filter by userId.
-- The RLS bypass is for platform admin cross-tenant access.
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "NotificationPreference" FOR ALL
USING (
    current_setting('app.rls_bypass', true) = 'true'
    OR "userId" = current_setting('app.current_user_id', true)
)
WITH CHECK (
    current_setting('app.rls_bypass', true) = 'true'
    OR "userId" = current_setting('app.current_user_id', true)
);

-- Add composite index for "recent notifications" query (already in schema
-- but ensure it exists on the DB)
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
    ON "Notification"("userId", "createdAt");
