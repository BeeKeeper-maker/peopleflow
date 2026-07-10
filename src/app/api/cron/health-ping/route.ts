/**
 * CRON: Device Health Monitor + System Health Alerting
 *
 * Endpoint: GET /api/cron/health-ping
 * Schedule: Every 5–15 minutes
 *
 * Two responsibilities:
 *   1. Device health — scan SyncApiKeys for devices that haven't synced
 *      within the threshold window; emit `device.offline` events.
 *   2. System health — probe DB + Redis; if either is down, fire an
 *      email + optional Slack/Discord webhook (with a 30-min cooldown).
 *      Implemented in `@/lib/health-alert` so the alerting path can be
 *      unit-tested independently of the cron runtime.
 *
 * Both responsibilities are non-fatal: an exception in one branch is
 * logged and the cron still returns a structured JSON response so the
 * scheduler doesn't crash on partial failures.
 */

import { verifyCronAuth, cronResponse } from "@/lib/cron-auth";
import { emit } from "@/lib/event-bus";
import { prisma } from "@/lib/prisma";
import { cronLogger } from "@/lib/logger";
import { checkHealthAndAlert } from "@/lib/health-alert";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// A device is considered "offline" if no sync received for this many minutes
const OFFLINE_THRESHOLD_MINUTES = 30;

export async function GET(req: Request) {
    // ── Auth ──
    const authError = verifyCronAuth(req);
    if (authError) return authError;

    const startTime = Date.now();

    // ── System health (DB + Redis) with alerting ──
    // Runs first so that even if the device scan below blows up, we have
    // still probed core dependencies and (if needed) sent an alert.
    let systemHealth: { healthy: boolean; failures: string[] } = {
        healthy: true,
        failures: [],
    };
    try {
        systemHealth = await checkHealthAndAlert();
    } catch (error) {
        // checkHealthAndAlert is designed to never throw, but defend in depth
        // so a regression cannot crash the device-scan half of this cron.
        cronLogger.error({ err: error }, "[CRON] health-ping: checkHealthAndAlert threw");
        systemHealth = {
            healthy: false,
            failures: [
                `Health-check orchestrator: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            ],
        };
    }

    try {
        const thresholdTime = new Date(
            Date.now() - OFFLINE_THRESHOLD_MINUTES * 60 * 1000
        );

        // Find active API keys that haven't synced recently
        // SyncApiKey uses `name` field (not `label`)
        const staleDevices = await prisma.syncApiKey.findMany({
            where: {
                isActive: true,
                revokedAt: null,
                lastSyncAt: {
                    lt: thresholdTime,
                    not: null, // Only check devices that have synced at least once
                },
            },
            select: {
                id: true,
                name: true,
                lastSyncAt: true,
                agentIp: true,
                organizationId: true,
                organization: {
                    select: { name: true },
                },
            },
        });

        let alertsSent = 0;

        for (const device of staleDevices) {
            // Check if we already sent an alert in the last hour for this device
            // (avoid notification spam)
            const recentAlert = await prisma.notification.findFirst({
                where: {
                    message: { contains: device.name },
                    type: "alert",
                    createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
                },
            });

            if (recentAlert) continue; // Already alerted within the hour

            await emit("device.offline", {
                organizationId: device.organizationId,
                deviceName: device.name,
                serialNumber: device.id.substring(0, 8),
                lastSeen: device.lastSyncAt?.toISOString() || "Never",
            });

            alertsSent++;
        }

        // Also check for devices that have NEVER synced (apiKey created but never used)
        const neverSynced = await prisma.syncApiKey.count({
            where: {
                isActive: true,
                revokedAt: null,
                lastSyncAt: null,
                createdAt: { lt: thresholdTime },
            },
        });

        // Cron status: "success" only when both system + device checks are clean.
        const hasDeviceIssues = staleDevices.length > 0;
        const status: "success" | "partial" | "error" =
            !systemHealth.healthy || hasDeviceIssues ? "partial" : "success";

        return cronResponse(
            {
                job: "device-health-ping",
                healthy: systemHealth.healthy,
                failures: systemHealth.failures,
                staleDevices: staleDevices.length,
                alertsSent,
                neverSyncedDevices: neverSynced,
                thresholdMinutes: OFFLINE_THRESHOLD_MINUTES,
                timestamp: new Date().toISOString(),
                durationMs: Date.now() - startTime,
            },
            status
        );
    } catch (error) {
        cronLogger.error({ err: error }, "[CRON] health-ping FATAL:");
        return cronResponse(
            {
                job: "device-health-ping",
                healthy: systemHealth.healthy,
                failures: systemHealth.failures,
                error: error instanceof Error ? error.message : "Unknown error",
                durationMs: Date.now() - startTime,
            },
            "error"
        );
    }
}
