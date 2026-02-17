/**
 * Biometric Attendance Sync Engine
 *
 * Orchestrates the full sync pipeline:
 *   Device → Pull logs → Map user IDs → Create/update Attendance records
 *
 * Handles check-in/check-out logic:
 *   - 1st punch of the day = check-in
 *   - Last punch of the day = check-out (if different from check-in)
 *
 * Uses the adapter pattern — works with any device brand.
 */

import { prisma } from "@/lib/prisma";
import { getAdapter } from "./device-adapter";
import { startOfDay, set, differenceInMinutes } from "date-fns";

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
}

// ── Main Sync Function ──────────────────────────────────────────────

/**
 * Sync a single biometric device: pull attendance logs,
 * map to employees, and create/update attendance records.
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
            error: "Device not found",
            duration: Date.now() - startTime,
        };
    }

    let recordsSynced = 0;
    let recordsSkipped = 0;
    let errorMessage: string | undefined;

    try {
        // 2. Get the appropriate adapter for this device's brand
        let adapter;
        try {
            adapter = getAdapter(device.model);
        } catch {
            throw new Error(`Device brand "${device.model}" is not supported yet. Only ZKTeco devices are currently supported.`);
        }

        // 3. Connect to device
        const connResult = await adapter.connect(device.ip, device.port);
        if (!connResult.success) {
            throw new Error(connResult.message);
        }

        try {
            // 4. Pull attendance logs since last sync
            const syncResult = await adapter.getAttendanceLogs(
                device.lastSyncAt || undefined
            );

            if (!syncResult.success) {
                throw new Error(syncResult.error || "Failed to fetch attendance logs");
            }

            // 5. Get employee mapping: biometricUserId → Employee
            const employees = await prisma.employee.findMany({
                where: {
                    organizationId: device.organizationId,
                    biometricUserId: { not: null },
                },
                select: {
                    id: true,
                    biometricUserId: true,
                    shift: {
                        select: {
                            startTime: true,
                            endTime: true,
                            graceMinutes: true,
                        },
                    },
                },
            });

            const employeeMap = new Map<string, typeof employees[0]>();
            for (const emp of employees) {
                if (emp.biometricUserId) {
                    employeeMap.set(emp.biometricUserId, emp);
                }
            }

            // 6. Group logs by user+date
            const logsByUserDate = new Map<string, { checkIn: Date; checkOut: Date | null }>();

            for (const log of syncResult.logs) {
                const employee = employeeMap.get(log.id);
                if (!employee) {
                    recordsSkipped++;
                    continue;
                }

                const dayKey = `${employee.id}|${startOfDay(log.timestamp).toISOString()}`;

                if (!logsByUserDate.has(dayKey)) {
                    logsByUserDate.set(dayKey, {
                        checkIn: log.timestamp,
                        checkOut: null,
                    });
                } else {
                    const existing = logsByUserDate.get(dayKey)!;
                    // Earlier time = check-in, later time = check-out
                    if (log.timestamp < existing.checkIn) {
                        existing.checkOut = existing.checkIn;
                        existing.checkIn = log.timestamp;
                    } else if (!existing.checkOut || log.timestamp > existing.checkOut) {
                        existing.checkOut = log.timestamp;
                    }
                }
            }

            // 7. Create/update attendance records
            for (const [dayKey, times] of logsByUserDate) {
                const separatorIdx = dayKey.indexOf("|");
                const employeeId = dayKey.substring(0, separatorIdx);
                const dateISO = dayKey.substring(separatorIdx + 1);
                const date = new Date(dateISO);

                // Calculate late minutes based on shift
                const employee = employees.find((e) => e.id === employeeId);
                let lateMinutes = 0;
                let status = "present";
                let earlyLeaveMinutes = 0;
                let overtimeMinutes = 0;

                if (employee?.shift) {
                    const [startH, startM] = employee.shift.startTime.split(":").map(Number);
                    const shiftStart = set(times.checkIn, {
                        hours: startH,
                        minutes: startM,
                        seconds: 0,
                    });
                    const grace = employee.shift.graceMinutes || 15;
                    const lateThreshold = new Date(
                        shiftStart.getTime() + grace * 60000
                    );

                    if (times.checkIn > lateThreshold) {
                        lateMinutes = differenceInMinutes(times.checkIn, shiftStart);
                        status = "present"; // still present, just late
                    }

                    // Calculate early leave / overtime if check-out exists
                    if (times.checkOut) {
                        const [endH, endM] = employee.shift.endTime.split(":").map(Number);
                        const shiftEnd = set(times.checkOut, {
                            hours: endH,
                            minutes: endM,
                            seconds: 0,
                        });

                        if (times.checkOut < shiftEnd) {
                            earlyLeaveMinutes = differenceInMinutes(
                                shiftEnd,
                                times.checkOut
                            );
                        } else {
                            overtimeMinutes = differenceInMinutes(
                                times.checkOut,
                                shiftEnd
                            );
                        }
                    }
                }

                try {
                    // Upsert — create if not exists, update check-out if exists
                    await prisma.attendance.upsert({
                        where: {
                            employeeId_date: {
                                employeeId,
                                date,
                            },
                        },
                        create: {
                            employeeId,
                            date,
                            checkIn: times.checkIn,
                            checkOut: times.checkOut,
                            source: "biometric",
                            status,
                            lateMinutes,
                            earlyLeaveMinutes,
                            overtimeMinutes,
                            notes: `Synced from ${device.name}`,
                        },
                        update: {
                            // Update check-in if biometric has data
                            checkIn: times.checkIn,
                            lateMinutes,
                            status,
                            source: "biometric",
                            // Update check-out if biometric has one
                            ...(times.checkOut
                                ? {
                                    checkOut: times.checkOut,
                                    earlyLeaveMinutes,
                                    overtimeMinutes,
                                }
                                : {}),
                        },
                    });
                    recordsSynced++;
                } catch {
                    recordsSkipped++;
                }
            }
        } finally {
            // Always disconnect
            await adapter.disconnect();
        }
    } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
    }

    const duration = Date.now() - startTime;
    const syncStatus = errorMessage ? "failed" : "success";

    // 8. Update device sync status + create sync log
    try {
        await prisma.$transaction([
            prisma.biometricDevice.update({
                where: { id: deviceId },
                data: {
                    lastSyncAt: errorMessage ? undefined : new Date(),
                    lastSyncStatus: syncStatus,
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
        console.error("Failed to save sync log:", logError);
    }

    return {
        success: !errorMessage,
        deviceId,
        deviceName: device.name,
        recordsSynced,
        recordsSkipped,
        error: errorMessage,
        duration,
    };
}

/**
 * Sync all active devices for an organization.
 */
export async function syncAllDevices(
    organizationId: string
): Promise<SyncDeviceResult[]> {
    const devices = await prisma.biometricDevice.findMany({
        where: { organizationId, isActive: true },
        select: { id: true },
    });

    const results: SyncDeviceResult[] = [];
    for (const device of devices) {
        const result = await syncDevice(device.id);
        results.push(result);
    }
    return results;
}
