/**
 * Biometric Attendance Sync Engine v2
 *
 * Enterprise-grade sync pipeline with:
 *   ✅ Night shift support (cross-midnight date anchoring)
 *   ✅ Parallel sync with concurrency limiting
 *   ✅ Failure tracking + automatic retry classification
 *   ✅ Shift-aware late/OT/early-leave calculations (via canonical punch-processor)
 *   ✅ sync_agent devices are NOT pinged from the cloud (private-LAN safe)
 *
 * Sync Pipeline (direct_cloud / cloud-pull mode only):
 *   Device → Pull logs → Determine shift date → Map user IDs →
 *   Calculate late/OT → Create/update Attendance records
 *
 * NOTE: For sync_agent devices, the cloud CANNOT open a TCP socket to the
 * device (it lives on a private office LAN). All punch ingestion for those
 * devices flows through /api/v1/sync/push, which is handled by the
 * canonical punch-processor. This file is now only used for direct_cloud
 * (ZKTeco devices with public IPs / NAT) and for the manual "Sync Now"
 * button when connectionMode = direct_cloud.
 *
 * Night Shift Logic:
 *   For shifts with crossesMidnight=true (e.g., 22:00→06:00):
 *   - Punches between shiftStart and midnight → attendance date = punch date
 *   - Punches between midnight and shiftEnd → attendance date = previous day
 *   - This anchors the entire work period to the date the shift STARTED
 */

import { prisma } from "@/lib/prisma";
import { getAdapter } from "./device-adapter";
import { biometricLogger } from "@/lib/logger";
import { ingestBiometricPunches } from "./punch-processor";

// Import ZKTeco adapter to register it
import "./zkteco-adapter";

// ── Types ────────────────────────────────────────────────────────────

export interface SyncDeviceResult {
    success: boolean;
    deviceId: string;
    deviceName: string;
    recordsSynced: number;
    recordsSkipped: number;
    error?: string;
    duration: number;
    retriable: boolean; // Whether this failure is worth retrying
}

// ── Main Sync Function ──────────────────────────────────────────────

/**
 * Sync a single biometric device: pull attendance logs,
 * map to employees, and create/update attendance records.
 *
 * IMPORTANT — sync_agent short-circuit:
 *   For devices with connectionMode = "sync_agent", the cloud CANNOT
 *   open a TCP socket to the device (it lives on a private office LAN).
 *   All punch ingestion for those devices flows through /api/v1/sync/push.
 *   This function returns a synthetic "agent-managed" result immediately
 *   and does NOT attempt a TCP connection, preventing false offline
 *   alerts and DB write pressure.
 *
 *   Only direct_cloud devices (with public IPs / NAT) are actually
 *   pulled from the cloud here.
 */
export async function syncDevice(deviceId: string): Promise<SyncDeviceResult> {
    const startTime = Date.now();

    // 1. Get device config from DB
    const device = await prisma.biometricDevice.findUnique({
        where: { id: deviceId },
        include: {
            organization: { select: { id: true } },
            branch: { select: { id: true, name: true } },
        },
    });

    if (!device) {
        return {
            success: false,
            deviceId,
            deviceName: "Unknown",
            recordsSynced: 0,
            recordsSkipped: 0,
            error: "Device not found in database",
            duration: Date.now() - startTime,
            retriable: false, // Config issue — don't retry
        };
    }

    // 2. SHORT-CIRCUIT: sync_agent devices are NOT reachable from the cloud.
    //    Their data arrives via the Sync Agent → /api/v1/sync/push →
    //    canonical punch-processor. Return a synthetic success so the
    //    dashboard's "Sync Now" button gives helpful feedback instead of
    //    a false "connection failed" error.
    if (device.connectionMode === "sync_agent") {
        const ageMs = device.lastSyncAt
            ? Date.now() - device.lastSyncAt.getTime()
            : null;
        const stale = ageMs !== null && ageMs > device.syncInterval * 60 * 1000 * 3;
        return {
            success: true,
            deviceId,
            deviceName: device.name,
            recordsSynced: 0,
            recordsSkipped: 0,
            error: stale
                ? `Sync Agent has not pushed data in ${Math.round((ageMs || 0) / 60000)} minutes. Check that the PeopleFlow Sync Agent is running on the office PC.`
                : undefined,
            duration: Date.now() - startTime,
            retriable: false,
        };
    }

    let recordsSynced = 0;
    let recordsSkipped = 0;
    let errorMessage: string | undefined;
    let retriable = true;

    try {
        // 3. Get the appropriate adapter for this device's brand
        let adapter;
        try {
            adapter = getAdapter(device.model);
        } catch {
            throw Object.assign(
                new Error(`Device brand "${device.model}" is not supported. Only ZKTeco devices are currently supported.`),
                { retriable: false }
            );
        }

        // 4. Connect to device (direct_cloud mode — public IP required)
        const connResult = await adapter.connect(device.ip, device.port);
        if (!connResult.success) {
            throw Object.assign(
                new Error(`Connection failed: ${connResult.message}`),
                { retriable: true } // Network issue — worth retrying
            );
        }

        try {
            // 5. Pull attendance logs since last sync
            const syncResult = await adapter.getAttendanceLogs(
                device.lastSyncAt || undefined
            );

            if (!syncResult.success) {
                throw Object.assign(
                    new Error(syncResult.error || "Failed to fetch attendance logs"),
                    { retriable: true }
                );
            }

            // 6. Delegate punch processing to the CANONICAL punch processor.
            //    This ensures direct_cloud devices use the same merge semantics,
            //    timezone handling, and shift-date logic as sync_agent devices.
            const ingestResult = await ingestBiometricPunches({
                organizationId: device.organizationId,
                records: syncResult.logs.map((log) => ({
                    userId: log.id,
                    timestamp: log.timestamp.toISOString(),
                    type: 0,
                    serialNumber: device.serialNumber || undefined,
                })),
                source: "biometric",
                deviceId: device.id,
                deviceName: device.name,
            });

            recordsSynced = ingestResult.synced;
            recordsSkipped = ingestResult.skipped + ingestResult.unmappedUsers;

            if (ingestResult.errors && ingestResult.errors.length > 0) {
                biometricLogger.warn(
                    { deviceId, errors: ingestResult.errors.slice(0, 3) },
                    "Punch ingestion had errors",
                );
            }
        } finally {
            // Always disconnect
            await adapter.disconnect();
        }
    } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        retriable = (error as any)?.retriable !== false;
    }

    const duration = Date.now() - startTime;
    const syncStatus = errorMessage ? "failed" : "success";

    // 7. Update device sync status + create sync log + update health
    try {
        await prisma.$transaction([
            prisma.biometricDevice.update({
                where: { id: deviceId },
                data: {
                    lastSyncAt: errorMessage ? undefined : new Date(),
                    lastSyncStatus: syncStatus,
                    // Update health metrics
                    ...(errorMessage
                        ? { consecutiveFailures: { increment: 1 } }
                        : {
                            consecutiveFailures: 0,
                            isOnline: true,
                            lastPingAt: new Date(),
                        }),
                },
            }),
            prisma.deviceSyncLog.create({
                data: {
                    deviceId,
                    status: syncStatus,
                    recordsSynced,
                    recordsSkipped,
                    errorMessage: errorMessage || null,
                    syncDuration: duration,
                },
            }),
        ]);
    } catch (logError) {
        biometricLogger.error({ err: logError, deviceId }, "Failed to save sync log");
    }

    return {
        success: !errorMessage,
        deviceId,
        deviceName: device.name,
        recordsSynced,
        recordsSkipped,
        error: errorMessage,
        duration,
        retriable,
    };
}

// ── Parallel Sync with Concurrency Limit ────────────────────────────

/**
 * Sync all active devices for an organization — IN PARALLEL with concurrency limit.
 *
 * Previous version was sequential (10 devices = 10× slower).
 * Now uses a concurrency pool to process up to `concurrency` devices simultaneously.
 */
export async function syncAllDevices(
    organizationId: string,
    concurrency: number = 5
): Promise<SyncDeviceResult[]> {
    const devices = await prisma.biometricDevice.findMany({
        where: { organizationId, isActive: true },
        select: { id: true },
    });

    if (devices.length === 0) return [];

    const results: SyncDeviceResult[] = [];
    const queue = [...devices];

    // Process `concurrency` devices at a time
    async function runBatch() {
        while (queue.length > 0) {
            const batch = queue.splice(0, concurrency);
            const batchResults = await Promise.allSettled(
                batch.map((device) => syncDevice(device.id))
            );

            for (const result of batchResults) {
                if (result.status === "fulfilled") {
                    results.push(result.value);
                } else {
                    results.push({
                        success: false,
                        deviceId: "unknown",
                        deviceName: "Unknown",
                        recordsSynced: 0,
                        recordsSkipped: 0,
                        error: result.reason?.message || "Unknown error",
                        duration: 0,
                        retriable: true,
                    });
                }
            }
        }
    }

    await runBatch();
    return results;
}

/**
 * Sync a single device by organization + device filters.
 * Used by the BullMQ worker for individual device sync jobs.
 */
export async function syncDeviceById(deviceId: string): Promise<SyncDeviceResult> {
    return syncDevice(deviceId);
}
