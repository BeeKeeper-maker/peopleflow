/**
 * CRON: Device Health Monitor
 * 
 * Endpoint: GET /api/cron/health-ping
 * Schedule: Every 5 minutes
 * 
 * Checks all active biometric devices (via SyncApiKey) for ones that
 * haven't synced within the expected interval. Emits device.offline
 * events to alert HR admins.
 */

import { verifyCronAuth, cronResponse } from "@/lib/cron-auth";
import { emit } from "@/lib/event-bus";
import { prisma } from "@/lib/prisma";
import { cronLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// A device is considered "offline" if no sync received for this many minutes
const OFFLINE_THRESHOLD_MINUTES = 30;

export async function GET(req: Request) {
    // ── Auth ──
    const authError = verifyCronAuth(req);
    if (authError) return authError;

    const startTime = Date.now();

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

        return cronResponse(
            {
                job: "device-health-ping",
                staleDevices: staleDevices.length,
                alertsSent,
                neverSyncedDevices: neverSynced,
                thresholdMinutes: OFFLINE_THRESHOLD_MINUTES,
                durationMs: Date.now() - startTime,
            },
            staleDevices.length > 0 ? "partial" : "success"
        );
    } catch (error) {
        cronLogger.error({ err: error }, "[CRON] health-ping FATAL:");
        return cronResponse(
            {
                job: "device-health-ping",
                error: error instanceof Error ? error.message : "Unknown error",
                durationMs: Date.now() - startTime,
            },
            "error"
        );
    }
}
