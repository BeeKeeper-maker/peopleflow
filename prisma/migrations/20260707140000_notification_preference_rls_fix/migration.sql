-- ═══════════════════════════════════════════════════════════════════
-- NotificationPreference RLS Fix
-- ═══════════════════════════════════════════════════════════════════
-- The original RLS policy referenced app.current_user_id which is
-- never set by the application. All NotificationPreference queries
-- return 0 rows in production with RLS enforced.
--
-- Fix: Rewrite policy to derive org from User table instead.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS tenant_isolation ON "NotificationPreference";
DROP POLICY IF EXISTS platform_bypass ON "NotificationPreference";

CREATE POLICY tenant_isolation ON "NotificationPreference" FOR ALL
    USING (
        current_setting('app.rls_bypass', true) = 'true'
        OR "userId" IN (
            SELECT id FROM "User"
            WHERE "organizationId" = current_setting('app.current_tenant_id', true)
        )
    )
    WITH CHECK (
        current_setting('app.rls_bypass', true) = 'true'
        OR "userId" IN (
            SELECT id FROM "User"
            WHERE "organizationId" = current_setting('app.current_tenant_id', true)
        )
    );
