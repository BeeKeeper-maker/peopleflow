/**
 * Health Check Alerting
 *
 * Sends alerts (email + optional Slack/Discord webhook) when system
 * dependencies become unhealthy. Uses an in-memory cooldown to prevent
 * alert spam — at most one alert per `COOLDOWN_MS` window.
 *
 * All alert side-effects (email + webhook) are wrapped in try/catch so
 * that alerting failures never crash the cron that called
 * `checkHealthAndAlert`. The cron's contract is: best-effort alert, then
 * return the structured health result.
 *
 * Env vars:
 *   HEALTH_ALERT_EMAILS   — comma-separated recipient list
 *   HEALTH_ALERT_WEBHOOK  — optional Slack/Discord incoming-webhook URL
 *   NEXTAUTH_URL          — used to build the deep-health + monitor links
 */

import { apiLogger } from "@/lib/logger";

interface HealthAlertConfig {
    emailRecipients: string[]; // Configured via env: HEALTH_ALERT_EMAILS
    webhookUrl?: string; // Optional Slack/Discord webhook: HEALTH_ALERT_WEBHOOK
    cooldownMinutes: number; // Don't re-alert within this window (default: 30)
}

interface HealthFailure {
    service: string;
    error: string;
}

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

let lastAlertTime: Date | null = null;

function loadConfig(): HealthAlertConfig {
    const emailRecipients =
        process.env.HEALTH_ALERT_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean) || [];
    const webhookUrl = process.env.HEALTH_ALERT_WEBHOOK || undefined;
    return { emailRecipients, webhookUrl, cooldownMinutes: 30 };
}

/**
 * Send a health alert when the system is unhealthy.
 * Uses email + optional webhook (Slack/Discord).
 * Has a cooldown to prevent alert spam.
 *
 * All side-effects are non-fatal: any failure in email/webhook dispatch
 * is logged and swallowed so the caller (cron) cannot be destabilised
 * by an alerting regression.
 */
export async function sendHealthAlert(failures: HealthFailure[]): Promise<void> {
    const now = new Date();

    // Cooldown check — at most one alert per COOLDOWN_MS window
    if (lastAlertTime && now.getTime() - lastAlertTime.getTime() < COOLDOWN_MS) {
        apiLogger.warn({ failures, lastAlertTime }, "Health alert suppressed (cooldown)");
        return;
    }

    lastAlertTime = now;

    const cfg = loadConfig();

    const subject = `🚨 PeopleFlow Health Alert — ${failures.length} service(s) down`;
    const body = `
PeopleFlow HRMS Health Alert

Time: ${now.toISOString()}
Failures:
${failures.map((f) => `  - ${f.service}: ${f.error}`).join("\n")}

Please investigate immediately.
Health endpoint: ${process.env.NEXTAUTH_URL || ""}/api/health?deep=1
System monitor: ${process.env.NEXTAUTH_URL || ""}/settings/system-monitor
`.trim();

    // Send email (non-fatal)
    if (cfg.emailRecipients.length > 0) {
        try {
            const { sendEmail } = await import("@/lib/email");
            await sendEmail({
                to: cfg.emailRecipients,
                subject,
                html: `<pre>${body}</pre>`,
            });
            apiLogger.info({ recipients: cfg.emailRecipients }, "Health alert email sent");
        } catch (err) {
            apiLogger.error({ err }, "Failed to send health alert email");
        }
    }

    // Send webhook (Slack/Discord) — non-fatal
    if (cfg.webhookUrl) {
        try {
            await fetch(cfg.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: subject,
                    attachments: [
                        {
                            color: "danger",
                            text: body,
                            ts: Math.floor(now.getTime() / 1000),
                        },
                    ],
                }),
            });
            apiLogger.info("Health alert webhook sent");
        } catch (err) {
            apiLogger.error({ err }, "Failed to send health alert webhook");
        }
    }
}

/**
 * Check system health and alert if unhealthy.
 * Called by the health-ping cron.
 *
 * Returns a structured result; never throws — every dependency check
 * is wrapped in try/catch so the cron always gets a clean JSON shape
 * to log/return.
 */
export async function checkHealthAndAlert(): Promise<{
    healthy: boolean;
    failures: string[];
}> {
    const failures: HealthFailure[] = [];

    // ── Database ──
    try {
        const { prisma } = await import("@/lib/prisma");
        await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
        failures.push({
            service: "Database",
            error: err instanceof Error ? err.message : "Unknown",
        });
    }

    // ── Redis ──
    try {
        const { getRedis, isRedisDisabledForRuntime } = await import("@/lib/redis");
        // Skip in test/build runtimes — Redis is intentionally absent there.
        if (!isRedisDisabledForRuntime()) {
            const redis = getRedis();
            // `getRedis()` always returns a client (lazy-connect); a real
            // connectivity probe is `ping()`. If it cannot reach Redis the
            // promise rejects and we record a failure below.
            await redis.ping();
        }
    } catch (err) {
        failures.push({
            service: "Redis",
            error: err instanceof Error ? err.message : "Unknown",
        });
    }

    // ── Alert (if anything failed) ──
    if (failures.length > 0) {
        // Non-fatal: alerting failures must not bubble up to the cron.
        try {
            await sendHealthAlert(failures);
        } catch (err) {
            apiLogger.error({ err }, "sendHealthAlert threw (should not happen)");
        }
    }

    return {
        healthy: failures.length === 0,
        failures: failures.map((f) => `${f.service}: ${f.error}`),
    };
}

/**
 * Reset the in-memory cooldown — exposed for tests.
 */
export function __resetHealthAlertCooldownForTests(): void {
    lastAlertTime = null;
}
