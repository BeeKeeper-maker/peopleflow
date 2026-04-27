/**
 * Biometric Sync Worker
 *
 * BullMQ worker for biometric device data synchronization.
 * Handles three job types:
 *   - sync-device: Sync a single device with retry/DLQ classification
 *   - sync-all-org-devices: Sync all devices for an organization in parallel
 *   - retry-failed-device: Retry a previously failed device sync
 *
 * Retry Strategy:
 *   - Network errors (retriable=true): Exponential backoff up to 5 attempts
 *   - Config errors (retriable=false): Fail immediately, alert admin
 *   - After max retries exhausted: Log to DLQ, send offline alert
 *
 * Run as part of the worker service:
 *   npx tsx src/workers/index.ts
 */

import { Worker, type Job } from "bullmq";
import {
    redisConnection,
    biometricSyncQueue,
    type BiometricSyncJobData,
} from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { syncDevice, syncAllDevices } from "@/lib/biometric/sync-engine";
import { createBulkNotifications } from "@/lib/notifications";
import { biometricLogger } from "@/lib/logger";

const WORKER_NAME = "BIOMETRIC_SYNC";

// ── Worker Definition ───────────────────────────────────────────────

const biometricSyncWorker = new Worker<BiometricSyncJobData>(
    "biometric-sync",
    async (job: Job<BiometricSyncJobData>) => {
        const { type, deviceId, organizationId } = job.data;

        biometricLogger.info({ type, attempt: job.attemptsMade + 1, maxAttempts: job.opts?.attempts || 5 }, `Processing job: ${type}`);

        switch (type) {
            case "sync-device": {
                if (!deviceId) throw new Error("deviceId is required for sync-device");

                const result = await syncDevice(deviceId);

                if (!result.success) {
                    // If the error is not retriable, don't let BullMQ retry
                    if (!result.retriable) {
                        biometricLogger.error({ deviceName: result.deviceName, error: result.error }, "Non-retriable sync error");
                        // Alert admins about config issue
                        await alertAdminsAboutDevice(deviceId, result.error || "Non-retriable sync error");
                        return result; // Return instead of throw — marks job as complete
                    }

                    // Retriable error — throw to trigger BullMQ retry
                    throw new Error(`Device ${result.deviceName} sync failed: ${result.error}`);
                }

                biometricLogger.info({ deviceName: result.deviceName, recordsSynced: result.recordsSynced, duration: result.duration }, "Device synced successfully");
                return result;
            }

            case "sync-all-org-devices": {
                if (!organizationId) throw new Error("organizationId required for sync-all-org-devices");

                const results = await syncAllDevices(organizationId);
                const failed = results.filter((r) => !r.success);
                const succeeded = results.filter((r) => r.success);

                biometricLogger.info({ succeeded: succeeded.length, failed: failed.length }, "Org sync complete");

                // Re-queue retriable failures as individual device sync jobs
                for (const failure of failed) {
                    if (failure.retriable) {
                        await biometricSyncQueue.add(
                            "retry-failed-device",
                            {
                                type: "retry-failed-device",
                                deviceId: failure.deviceId,
                                previousError: failure.error,
                            },
                            {
                                delay: 60000, // Wait 1 minute before retrying
                                attempts: 3,  // Fewer retries for re-queued jobs
                            }
                        );
                        biometricLogger.info({ deviceName: failure.deviceName }, "Re-queued device for retry");
                    }
                }

                return { total: results.length, succeeded: succeeded.length, failed: failed.length };
            }

            case "retry-failed-device": {
                if (!deviceId) throw new Error("deviceId is required for retry-failed-device");

                biometricLogger.info({ deviceId, previousError: job.data.previousError }, "Retrying failed device");
                const result = await syncDevice(deviceId);

                if (!result.success) {
                    // Check if this device has exceeded max consecutive failures
                    const device = await prisma.biometricDevice.findUnique({
                        where: { id: deviceId },
                        select: { consecutiveFailures: true, maxRetries: true, name: true, organizationId: true },
                    });

                    if (device && device.consecutiveFailures >= device.maxRetries) {
                        biometricLogger.error({ deviceName: device.name, consecutiveFailures: device.consecutiveFailures, maxRetries: device.maxRetries }, "Device exceeded max retries, marking offline");

                        // Mark device as offline
                        await prisma.biometricDevice.update({
                            where: { id: deviceId },
                            data: { isOnline: false },
                        });

                        // Alert admins
                        await alertAdminsAboutDevice(deviceId, `Device "${device.name}" has been offline for ${device.consecutiveFailures} consecutive sync attempts. Last error: ${result.error}`);

                        return result; // Don't throw — stop retrying
                    }

                    if (!result.retriable) return result;
                    throw new Error(`Retry failed: ${result.error}`);
                }

                biometricLogger.info({ deviceName: result.deviceName }, "Retry succeeded");
                return result;
            }

            default:
                throw new Error(`Unknown job type: ${type}`);
        }
    },
    {
        connection: redisConnection,
        concurrency: 3, // Process up to 3 sync jobs in parallel
        limiter: {
            max: 10,       // Max 10 jobs
            duration: 60000, // per minute (prevent hammering devices)
        },
    }
);

// ── Event Handlers ──────────────────────────────────────────────────

biometricSyncWorker.on("completed", (job) => {
    biometricLogger.debug({ jobName: job.name }, "Job completed");
});

biometricSyncWorker.on("failed", (job, err) => {
    biometricLogger.error({ jobName: job?.name, attempt: job?.attemptsMade, err }, "Job failed");
});

biometricSyncWorker.on("error", (err) => {
    biometricLogger.error({ err }, "Worker error");
});

// ── Admin Alert Utility ─────────────────────────────────────────────

/**
 * Alert organization admins when a biometric device has persistent issues.
 * Rate-limited: only sends one alert per device per 4 hours.
 */
async function alertAdminsAboutDevice(deviceId: string, errorMessage: string): Promise<void> {
    try {
        const device = await prisma.biometricDevice.findUnique({
            where: { id: deviceId },
            select: {
                name: true,
                organizationId: true,
                alertSentAt: true,
                ip: true,
                branch: { select: { name: true } },
            },
        });

        if (!device) return;

        // Rate limit: skip if alert was sent within last 4 hours
        if (device.alertSentAt) {
            const hoursSinceLastAlert = (Date.now() - device.alertSentAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastAlert < 4) return;
        }

        // Find admin users for this organization
        const admins = await prisma.user.findMany({
            where: {
                organizationId: device.organizationId,
                role: { in: ["admin", "hr_admin", "super_admin"] },
            },
            select: { id: true },
        });

        if (admins.length === 0) return;

        const location = device.branch?.name || "Unknown location";

        await createBulkNotifications(
            admins.map((a) => a.id),
            {
                title: "⚠️ Biometric Device Offline",
                message: `Device "${device.name}" (${device.ip}) at ${location} is unreachable. Error: ${errorMessage.substring(0, 150)}`,
                type: "alert",
                link: "/settings/biometric-devices",
            }
        );

        // Update alert timestamp
        await prisma.biometricDevice.update({
            where: { id: deviceId },
            data: { alertSentAt: new Date() },
        });

        biometricLogger.info({ admins: admins.length, deviceName: device.name }, "Alert sent to admins");
    } catch (error) {
        biometricLogger.error({ err: error, deviceId }, "Failed to send admin alert");
    }
}

// ── Public API for enqueueing sync jobs ─────────────────────────────

/**
 * Enqueue a sync job for a single device.
 * Used by API routes and the device health worker.
 */
export async function enqueueSyncDevice(deviceId: string): Promise<void> {
    await biometricSyncQueue.add("sync-device", {
        type: "sync-device",
        deviceId,
    });
}

/**
 * Enqueue sync for all devices in an organization.
 * Used by CRON scheduler or manual trigger.
 */
export async function enqueueSyncAllDevices(organizationId: string): Promise<void> {
    await biometricSyncQueue.add("sync-all-org-devices", {
        type: "sync-all-org-devices",
        organizationId,
    });
}

biometricLogger.info("Biometric sync worker started");

export default biometricSyncWorker;
