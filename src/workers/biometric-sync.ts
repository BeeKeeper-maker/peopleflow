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

const WORKER_NAME = "BIOMETRIC_SYNC";

// ── Worker Definition ───────────────────────────────────────────────

const biometricSyncWorker = new Worker<BiometricSyncJobData>(
    "biometric-sync",
    async (job: Job<BiometricSyncJobData>) => {
        const { type, deviceId, organizationId } = job.data;

        console.log(`[${WORKER_NAME}] Processing job: ${type} (attempt ${job.attemptsMade + 1}/${job.opts?.attempts || 5})`);

        switch (type) {
            case "sync-device": {
                if (!deviceId) throw new Error("deviceId is required for sync-device");

                const result = await syncDevice(deviceId);

                if (!result.success) {
                    // If the error is not retriable, don't let BullMQ retry
                    if (!result.retriable) {
                        console.error(`[${WORKER_NAME}] Non-retriable error for device ${result.deviceName}: ${result.error}`);
                        // Alert admins about config issue
                        await alertAdminsAboutDevice(deviceId, result.error || "Non-retriable sync error");
                        return result; // Return instead of throw — marks job as complete
                    }

                    // Retriable error — throw to trigger BullMQ retry
                    throw new Error(`Device ${result.deviceName} sync failed: ${result.error}`);
                }

                console.log(`[${WORKER_NAME}] ✅ Device "${result.deviceName}" synced: ${result.recordsSynced} records in ${result.duration}ms`);
                return result;
            }

            case "sync-all-org-devices": {
                if (!organizationId) throw new Error("organizationId required for sync-all-org-devices");

                const results = await syncAllDevices(organizationId);
                const failed = results.filter((r) => !r.success);
                const succeeded = results.filter((r) => r.success);

                console.log(`[${WORKER_NAME}] ✅ Org sync complete: ${succeeded.length} succeeded, ${failed.length} failed`);

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
                        console.log(`[${WORKER_NAME}] Re-queued device "${failure.deviceName}" for retry`);
                    }
                }

                return { total: results.length, succeeded: succeeded.length, failed: failed.length };
            }

            case "retry-failed-device": {
                if (!deviceId) throw new Error("deviceId is required for retry-failed-device");

                console.log(`[${WORKER_NAME}] Retrying failed device ${deviceId} (previous error: ${job.data.previousError})`);
                const result = await syncDevice(deviceId);

                if (!result.success) {
                    // Check if this device has exceeded max consecutive failures
                    const device = await prisma.biometricDevice.findUnique({
                        where: { id: deviceId },
                        select: { consecutiveFailures: true, maxRetries: true, name: true, organizationId: true },
                    });

                    if (device && device.consecutiveFailures >= device.maxRetries) {
                        console.error(`[${WORKER_NAME}] 🔴 Device "${device.name}" has exceeded max retries (${device.consecutiveFailures}/${device.maxRetries}). Marking offline.`);

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

                console.log(`[${WORKER_NAME}] ✅ Retry succeeded for device "${result.deviceName}"`);
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
    console.log(`[${WORKER_NAME}] Job ${job.name} completed`);
});

biometricSyncWorker.on("failed", (job, err) => {
    console.error(`[${WORKER_NAME}] Job ${job?.name} failed (attempt ${job?.attemptsMade}): ${err.message}`);
});

biometricSyncWorker.on("error", (err) => {
    console.error(`[${WORKER_NAME}] Worker error:`, err.message);
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
                role: { in: ["admin", "hr_admin", "superadmin"] },
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

        console.log(`[${WORKER_NAME}] Alert sent to ${admins.length} admins for device "${device.name}"`);
    } catch (error) {
        console.error(`[${WORKER_NAME}] Failed to send alert:`, error);
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

console.log(`[${WORKER_NAME}] Worker started`);

export default biometricSyncWorker;
