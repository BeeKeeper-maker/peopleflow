-- ═══════════════════════════════════════════════════════════════════
-- BiometricPunch RLS Platform Bypass Fix
-- ═══════════════════════════════════════════════════════════════════
-- The BiometricPunch table was created with tenant_isolation policy
-- but no platform_bypass policy. Platform admin queries (withPlatform)
-- fail because current_setting('app.rls_bypass') is not checked.
-- ═══════════════════════════════════════════════════════════════════

CREATE POLICY platform_bypass ON "BiometricPunch" FOR ALL
    USING (current_setting('app.rls_bypass', true) = 'true')
    WITH CHECK (current_setting('app.rls_bypass', true) = 'true');
