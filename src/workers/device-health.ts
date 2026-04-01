/**
 * Device Health Monitor Worker
 *
 * BullMQ worker for biometric device heartbeat monitoring.
 * Runs every 5 minutes to verify all active devices are reachable.
 *
 * Pipeline:
 *   1. Fetch all active devices across all organizations
 *   2. Attempt TCP connection to each device (connect + immediate disconnect)
 *   3. Log health status (online/offline/timeout/connection_refused)
 *   4. Track latency for performance monitoring
 *   5. Update device online/offline status
 *   6. If device newly goes offline → alert admins
 *   7. If device comes back online after being offline → clear alert state
 *
 * Health logs are kept for 30 days (pruned by a separate maintenance job).
 */

import { Worker, type Job } from "bullmq";
import {
    redisConnection,
    biometricSyncQueue,
    type DeviceHealthJobData,
} from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/biometric/device-adapter";
import { createBulkNotifications } from "@/lib/notifications";

// Import ZKTeco adapter to register it
import "@/lib/biometric/zkteco-adapter";

const WORKER_NAME = "DEVICE_HEALTH";

// ── Worker Definition ───────────────────────────────────────────────

const deviceHealthWorker = new Worker<DeviceHealthJobData>(
    "device-health",
    async (job: Job<DeviceHealthJobData>) => {
        const { type, deviceId } = job.data;

        switch (type) {
            case "ping-all-devices": {
                console.log(`[${WORKER_NAME}] Starting health check for all active devices...`);

                const devices = await prisma.biometricDevice.findMany({
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        model: true,
                        ip: true,
                        port: true,
                        isOnline: true,
                        consecutiveFailures: true,
                        organizationId: true,
                        syncInterval: true,
                        lastSyncAt: true,
                        alertSentAt: true,
                        branch: { select: { name: true } },
                    },
                });

                if (devices.length === 0) {
                    console.log(`[${WORKER_NAME}] No active devices found.`);
                    return { checked: 0, online: 0, offline: 0 };
                }

                let onlineCount = 0;
                let offlineCount = 0;
                const newlyOffline: string[] = [];
                const recovered: string[] = [];

                // Ping devices in parallel (max 10 concurrent)
                const PING_CONCURRENCY = 10;
                const deviceQueue = [...devices];

                while (deviceQueue.length > 0) {
                    const batch = deviceQueue.splice(0, PING_CONCURRENCY);
                    const results = await Promise.allSettled(
                        batch.map((device) => pingDevice(device))
                    );

                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];
                        const device = batch[i];
                        const wasOnline = device.isOnline;

                        if (result.status === "fulfilled" && result.value.online) {
                            onlineCount++;
                            if (!wasOnline) {
                                recovered.push(device.id);
                            }
                        } else {
                            offlineCount++;
                            if (wasOnline) {
                                newlyOffline.push(device.id);
                            }
                        }
                    }
                }

                // Send recovery notifications
                if (recovered.length > 0) {
                    console.log(`[${WORKER_NAME}] 🟢 ${recovered.length} device(s) recovered`);
                    for (const recoveredDeviceId of recovered) {
                        await handleDeviceRecovery(recoveredDeviceId);
                    }
                }

                // Send offline alerts (only for newly offline devices)
                if (newlyOffline.length > 0) {
                    console.log(`[${WORKER_NAME}] 🔴 ${newlyOffline.length} device(s) newly offline`);
                }

                // Trigger sync for online devices that are overdue
                for (const device of devices) {
                    if (device.isOnline || onlineCount > 0) {
                        const syncOverdue = device.lastSyncAt
                            ? (Date.now() - device.lastSyncAt.getTime()) > device.syncInterval * 60 * 1000
                            : true; // Never synced

                        if (syncOverdue) {
                            await biometricSyncQueue.add("sync-device", {
                                type: "sync-device",
                                deviceId: device.id,
                            });
                        }
                    }
                }

                const summary = {
                    checked: devices.length,
                    online: onlineCount,
                    offline: offlineCount,
                    recovered: recovered.length,
                    newlyOffline: newlyOffline.length,
                };

                console.log(`[${WORKER_NAME}] ✅ Health check complete:`, summary);
                return summary;
            }

            case "ping-device": {
                if (!deviceId) throw new Error("deviceId required for ping-device");

                const device = await prisma.biometricDevice.findUnique({
                    where: { id: deviceId },
                    select: {
                        id: true,
                        name: true,
                        model: true,
                        ip: true,
                        port: true,
                        isOnline: true,
                        consecutiveFailures: true,
                        organizationId: true,
                        alertSentAt: true,
                        branch: { select: { name: true } },
                    },
                });

                if (!device) throw new Error(`Device ${deviceId} not found`);

                const result = await pingDevice(device);
                return result;
            }

            default:
                throw new Error(`Unknown job type: ${type}`);
        }
    },
    {
        connection: redisConnection,
        concurrency: 1, // Only one health check batch at a time
    }
);

// ── Ping Logic ──────────────────────────────────────────────────────

interface PingResult {
    online: boolean;
    latencyMs: number | null;
    error?: string;
    status: string; // "online" | "offline" | "timeout" | "connection_refused"
}

interface DeviceForPing {
    id: string;
    name: string;
    model: string;
    ip: string;
    port: number;
    isOnline: boolean;
    consecutiveFailures: number;
    organizationId: string;
    alertSentAt: Date | null;
    branch: { name: string } | null;
}

/**
 * Ping a single device by attempting a TCP connection.
 * If successful → mark online, log health.
 * If failed → increment failure counter, log health, optionally alert.
 */
async function pingDevice(device: DeviceForPing): Promise<PingResult> {
    const startTime = Date.now();
    let online = false;
    let errorMsg: string | undefined;
    let status = "offline";

    try {
        const adapter = getAdapter(device.model);
        const connResult = await adapter.connect(device.ip, device.port);

        if (connResult.success) {
            online = true;
            status = "online";
            await adapter.disconnect();
        } else {
            status = connResult.message.includes("timeout") ? "timeout" : "connection_refused";
            errorMsg = connResult.message;
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        status = msg.includes("timeout") || msg.includes("ETIMEDOUT") ? "timeout" : "offline";
        errorMsg = msg;
    }

    const latencyMs = online ? Date.now() - startTime : null;

    // Update DB: device status + health log
    try {
        await prisma.$transaction([
            // Update device status
            prisma.biometricDevice.update({
                where: { id: device.id },
                data: {
                    isOnline: online,
                    lastPingAt: new Date(),
                    ...(online
                        ? { consecutiveFailures: 0 }
                        : { consecutiveFailures: { increment: 1 } }
                    ),
                },
            }),
            // Log health check
            prisma.deviceHealthLog.create({
                data: {
                    deviceId: device.id,
                    status,
                    latencyMs,
                    error: errorMsg?.substring(0, 500) || null,
                },
            }),
        ]);

        // Alert if device just went offline (was online → now offline)
        if (!online && device.isOnline) {
            await alertDeviceOffline(device, errorMsg || "Device unreachable");
        }
    } catch (dbError) {
        console.error(`[${WORKER_NAME}] Failed to save health log for ${device.name}:`, dbError);
    }

    return { online, latencyMs, error: errorMsg, status };
}

// ── Alert Handlers ──────────────────────────────────────────────────

/**
 * Alert admins when a device goes offline.
 * Rate-limited: only sends one alert per device per 2 hours.
 */
async function alertDeviceOffline(device: DeviceForPing, error: string): Promise<void> {
    // Rate limit: 2 hours between alerts per device
    if (device.alertSentAt) {
        const hoursSince = (Date.now() - device.alertSentAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 2) return;
    }

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
            title: "🔴 Biometric Device Offline",
            message: `"${device.name}" (${device.ip}) at ${location} went offline. Attendance data may be delayed. Error: ${error.substring(0, 100)}`,
            type: "alert",
            link: "/settings/biometric-devices",
        }
    );

    await prisma.biometricDevice.update({
        where: { id: device.id },
        data: { alertSentAt: new Date() },
    });

    console.log(`[${WORKER_NAME}] ⚠️ Offline alert sent for "${device.name}"`);
}

/**
 * Handle device recovery — notify admins the device is back online.
 * Also triggers an immediate sync to backfill any missed records.
 */
async function handleDeviceRecovery(deviceId: string): Promise<void> {
    const device = await prisma.biometricDevice.findUnique({
        where: { id: deviceId },
        select: {
            name: true,
            ip: true,
            organizationId: true,
            branch: { select: { name: true } },
        },
    });

    if (!device) return;

    // Notify admins of recovery
    const admins = await prisma.user.findMany({
        where: {
            organizationId: device.organizationId,
            role: { in: ["admin", "hr_admin", "superadmin"] },
        },
        select: { id: true },
    });

    if (admins.length > 0) {
        const location = device.branch?.name || "Unknown location";
        await createBulkNotifications(
            admins.map((a) => a.id),
            {
                title: "🟢 Biometric Device Back Online",
                message: `"${device.name}" (${device.ip}) at ${location} is back online. Syncing any missed attendance data now.`,
                type: "alert",
                link: "/settings/biometric-devices",
            }
        );
    }

    // Trigger immediate sync to backfill missed data
    await biometricSyncQueue.add("sync-device", {
        type: "sync-device",
        deviceId,
    }, {
        priority: 1, // High priority — catch up on missed data
    });

    // Clear alert state
    await prisma.biometricDevice.update({
        where: { id: deviceId },
        data: { alertSentAt: null, consecutiveFailures: 0 },
    });

    console.log(`[${WORKER_NAME}] 🟢 Device "${device.name}" recovered. Backfill sync queued.`);
}

// ── Event Handlers ──────────────────────────────────────────────────

deviceHealthWorker.on("completed", (job) => {
    console.log(`[${WORKER_NAME}] Job ${job.name} completed`);
});

deviceHealthWorker.on("failed", (job, err) => {
    console.error(`[${WORKER_NAME}] Job ${job?.name} failed: ${err.message}`);
});

deviceHealthWorker.on("error", (err) => {
    console.error(`[${WORKER_NAME}] Worker error:`, err.message);
});

console.log(`[${WORKER_NAME}] Worker started`);

export default deviceHealthWorker;
