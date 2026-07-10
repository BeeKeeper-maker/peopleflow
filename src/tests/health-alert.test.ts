/**
 * ═══════════════════════════════════════════════════════════════════
 * UNIT TESTS: Health Alerting (P14-TESTS)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Coverage for `src/lib/health-alert.ts` (added in P13):
 *
 *   sendHealthAlert(failures)
 *     - Sends email to HEALTH_ALERT_EMAILS recipients
 *     - POSTs JSON payload to HEALTH_ALERT_WEBHOOK (Slack/Discord)
 *     - 30-minute in-memory cooldown prevents alert spam
 *     - __resetHealthAlertCooldownForTests() clears cooldown for tests
 *     - Email + webhook failures are non-fatal (logged, swallowed)
 *
 *   checkHealthAndAlert()
 *     - Probes Postgres via `prisma.$queryRaw\`SELECT 1\``
 *     - Probes Redis via `getRedis().ping()` (skipped if runtime-disabled)
 *     - Calls sendHealthAlert(failures) when any probe fails
 *     - Returns { healthy, failures: string[] } — never throws
 *
 * Determinism: every external dependency is mocked.
 *   - @/lib/email        → mocked locally (sendEmail stub)
 *   - @/lib/redis        → mocked locally (getRedis / isRedisDisabledForRuntime stubs)
 *   - @/lib/prisma       → mocked globally in setup.ts ($queryRaw stub)
 *   - @/lib/logger       → mocked globally in setup.ts (noop)
 *   - global.fetch       → stubbed via vi.stubGlobal for webhook POSTs
 *
 * The 10 scenarios below map 1:1 to the P14-TESTS task spec a–j.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Module mocks (hoisted by vitest) ────────────────────────────────
// @/lib/prisma and @/lib/logger are already mocked globally in setup.ts.
// We mock @/lib/email and @/lib/redis locally so health-alert.ts's
// dynamic `await import(...)` calls resolve to these stubs.
vi.mock("@/lib/email", () => ({
    sendEmail: vi.fn(),
    sendTemplateEmail: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
    getRedis: vi.fn(),
    isRedisDisabledForRuntime: vi.fn(() => false),
}));

// ── Imports under test ─────────────────────────────────────────────
import {
    sendHealthAlert,
    checkHealthAndAlert,
    __resetHealthAlertCooldownForTests,
} from "@/lib/health-alert";
import { sendEmail } from "@/lib/email";
import { getRedis, isRedisDisabledForRuntime } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════
// Health Alerting
// ═══════════════════════════════════════════════════════════════════

describe("[P14-TESTS] health-alert", () => {
    const originalEnv: NodeJS.ProcessEnv = { ...process.env };

    beforeEach(() => {
        // Clear call history (keeps factory implementations).
        vi.clearAllMocks();

        // Reset the module-level cooldown so every test starts clean.
        __resetHealthAlertCooldownForTests();

        // ── Env defaults ────────────────────────────────────────────
        // No recipients / webhook by default — individual tests opt in.
        delete process.env.HEALTH_ALERT_EMAILS;
        delete process.env.HEALTH_ALERT_WEBHOOK;
        process.env.NEXTAUTH_URL = "https://hr.example.com";

        // ── Mock defaults ──────────────────────────────────────────
        // Email: resolves successfully.
        vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: "test-id" });

        // Prisma DB probe: resolves (healthy).
        vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }] as never);

        // Redis: not disabled, ping succeeds (healthy).
        vi.mocked(isRedisDisabledForRuntime).mockReturnValue(false);
        vi.mocked(getRedis).mockReturnValue({
            ping: vi.fn().mockResolvedValue("PONG"),
        } as never);

        // Webhook fetch: resolves with a 200-shaped response.
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: true, status: 200 } as never),
        );
    });

    afterEach(() => {
        // Restore env vars so tests don't leak configuration into each other.
        process.env = { ...originalEnv };
        vi.unstubAllGlobals();
    });

    // ── a) sendHealthAlert sends email ─────────────────────────────
    it("sendHealthAlert sends email to configured recipients with a descriptive subject", async () => {
        process.env.HEALTH_ALERT_EMAILS = "oncall@example.com, devops@example.com";
        const failures = [
            { service: "Database", error: "Connection refused" },
        ];

        await sendHealthAlert(failures);

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: ["oncall@example.com", "devops@example.com"],
                subject: expect.stringContaining("Health Alert"),
                html: expect.stringContaining("Database"),
            }),
        );
    });

    // ── b) sendHealthAlert sends webhook ───────────────────────────
    it("sendHealthAlert POSTs a JSON payload to the configured webhook URL", async () => {
        process.env.HEALTH_ALERT_WEBHOOK = "https://hooks.slack.com/services/T/B/X";
        const failures = [{ service: "Redis", error: "ECONNREFUSED" }];

        await sendHealthAlert(failures);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
            "https://hooks.slack.com/services/T/B/X",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: expect.stringContaining("Health Alert"),
            }),
        );
        // Email path must NOT fire when no recipients are configured.
        expect(sendEmail).not.toHaveBeenCalled();
    });

    // ── c) sendHealthAlert respects cooldown ───────────────────────
    it("suppresses a second alert within the 30-minute cooldown window", async () => {
        process.env.HEALTH_ALERT_EMAILS = "oncall@example.com";
        const failures = [{ service: "Database", error: "down" }];

        await sendHealthAlert(failures);
        await sendHealthAlert(failures); // within 30 min — should be suppressed

        // Only the first call should have dispatched an email.
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    // ── d) sendHealthAlert resets after cooldown ───────────────────
    it("fires again after the cooldown is reset via __resetHealthAlertCooldownForTests", async () => {
        process.env.HEALTH_ALERT_EMAILS = "oncall@example.com";
        const failures = [{ service: "Database", error: "down" }];

        await sendHealthAlert(failures);
        __resetHealthAlertCooldownForTests();
        await sendHealthAlert(failures);

        expect(sendEmail).toHaveBeenCalledTimes(2);
    });

    // ── e) sendHealthAlert handles email failure gracefully ────────
    it("does not throw when sendEmail rejects (non-fatal side-effect)", async () => {
        process.env.HEALTH_ALERT_EMAILS = "oncall@example.com";
        vi.mocked(sendEmail).mockRejectedValue(new Error("SMTP connection refused"));

        const failures = [{ service: "Database", error: "down" }];

        // Must resolve — email failures must never bubble up to the cron caller.
        await expect(sendHealthAlert(failures)).resolves.toBeUndefined();
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    // ── f) checkHealthAndAlert returns healthy when all pass ───────
    it("returns { healthy: true, failures: [] } when DB + Redis both succeed", async () => {
        const result = await checkHealthAndAlert();

        expect(result.healthy).toBe(true);
        expect(result.failures).toEqual([]);
        // No alert should be dispatched on a healthy probe.
        expect(sendEmail).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    // ── g) checkHealthAndAlert returns unhealthy when DB fails ─────
    it("returns unhealthy with a Database failure when $queryRaw rejects", async () => {
        vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("Connection refused"));

        const result = await checkHealthAndAlert();

        expect(result.healthy).toBe(false);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0]).toMatch(/^Database: /);
        expect(result.failures[0]).toContain("Connection refused");
    });

    // ── h) checkHealthAndAlert returns unhealthy when Redis fails ──
    it("returns unhealthy with a Redis failure when ping() rejects", async () => {
        vi.mocked(getRedis).mockReturnValue({
            ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
        } as never);

        const result = await checkHealthAndAlert();

        expect(result.healthy).toBe(false);
        expect(result.failures.some((f) => f.startsWith("Redis: "))).toBe(true);
        expect(result.failures.some((f) => f.startsWith("Database: "))).toBe(false);
    });

    // ── i) checkHealthAndAlert sends alert when unhealthy ──────────
    it("triggers sendHealthAlert (observed via sendEmail side-effect) when unhealthy", async () => {
        process.env.HEALTH_ALERT_EMAILS = "oncall@example.com";
        vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("down"));

        await checkHealthAndAlert();

        // checkHealthAndAlert → sendHealthAlert → sendEmail.
        // We assert on the side-effect (sendEmail) rather than spying on
        // sendHealthAlert directly because ESM live bindings don't let a
        // vi.spyOn on the module namespace intercept internal calls.
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: ["oncall@example.com"],
                subject: expect.stringContaining("Health Alert"),
            }),
        );
    });

    // ── j) checkHealthAndAlert does NOT send alert when healthy ────
    it("does NOT trigger sendHealthAlert when all probes are healthy", async () => {
        await checkHealthAndAlert();

        expect(sendEmail).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });
});
