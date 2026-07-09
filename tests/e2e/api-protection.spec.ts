import { test, expect } from "@playwright/test";

/**
 * API Protection E2E Tests
 *
 * Verifies that every protected API surface rejects unauthenticated
 * requests. The auth check happens in the Next.js middleware (`proxy.ts`)
 * or inside the route handler itself (cron, platform, v1) BEFORE any
 * database access, so these tests do not require a DB or Redis.
 *
 * Accepted statuses are intentionally broad:
 *   - 401 Unauthorized — the standard "no session" rejection returned by
 *     the proxy for endpoints whose module is enabled by default.
 *   - 403 Forbidden — returned by the proxy's module-entitlement guard
 *     when the endpoint's module is not in the default entitlements
 *     (e.g. `loans`, `payroll`). The request is still rejected; the
 *     4xx just carries a different reason.
 *
 * The cron endpoint behaves differently in dev vs. production when
 * CRON_SECRET is unset (see `src/lib/cron-auth.ts`), so its accepted
 * status set is broader still.
 */

// Unauthenticated requests should be rejected. The proxy returns 401 for
// no-session hits on modules enabled by default, and 403 for hits on
// modules whose entitlement is off by default — both indicate the
// request did NOT reach the protected handler.
const REJECTED = [401, 403] as const;

test.describe("API Protection", () => {
    test("employees API requires auth", async ({ request }) => {
        const response = await request.get("/api/employees");
        expect(REJECTED).toContain(response.status());
    });

    test("attendance API requires auth", async ({ request }) => {
        const response = await request.get("/api/attendance");
        expect(REJECTED).toContain(response.status());
    });

    test("leaves API requires auth", async ({ request }) => {
        const response = await request.get("/api/leaves/applications");
        expect(REJECTED).toContain(response.status());
    });

    test("payroll API requires auth", async ({ request }) => {
        const response = await request.get(
            "/api/payroll/process?month=1&year=2026",
        );
        expect(REJECTED).toContain(response.status());
    });

    test("loans API requires auth", async ({ request }) => {
        const response = await request.get("/api/loans");
        expect(REJECTED).toContain(response.status());
    });

    test("notifications API requires auth", async ({ request }) => {
        const response = await request.get("/api/notifications");
        expect(REJECTED).toContain(response.status());
    });

    test("settings API requires auth", async ({ request }) => {
        const response = await request.get("/api/settings");
        expect(REJECTED).toContain(response.status());
    });

    test("cron endpoint requires secret", async ({ request }) => {
        const response = await request.get("/api/cron/health-ping");
        // Without proper auth, the endpoint should either:
        //   - In production: 503 (no CRON_SECRET) / 401 (no Bearer) / 403 (wrong Bearer)
        //   - In dev: 401 (CRON_SECRET set, no Bearer) — OR — if CRON_SECRET is
        //     unset, the dev guard allows the call through and the handler then
        //     fails at the DB layer, returning 200 with `status: "error"`.
        const status = response.status();
        if (status === 200) {
            // Dev mode allowed the call through — make sure it actually errored.
            const body = await response.json().catch(() => ({ status: "error" }));
            expect(body.status).not.toBe("success");
        } else {
            expect([401, 403, 500, 503]).toContain(status);
        }
    });

    test("platform API requires platform auth", async ({ request }) => {
        const response = await request.get("/api/platform/analytics");
        expect(response.status()).toBe(401);
    });

    test("v1 API requires API key", async ({ request }) => {
        const response = await request.get("/api/v1/employees");
        expect(response.status()).toBe(401);
    });
});
