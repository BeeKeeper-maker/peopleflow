/**
 * Biometric Attendance Sync Engine v2
 *
 * Enterprise-grade sync pipeline with:
 *   ✅ Night shift support (cross-midnight date anchoring)
 *   ✅ Parallel sync with concurrency limiting
 *   ✅ Failure tracking + automatic retry classification
 *   ✅ Shift-aware late/OT/early-leave calculations
 *
 * Sync Pipeline:
 *   Device → Pull logs → Determine shift date → Map user IDs →
 *   Calculate late/OT → Create/update Attendance records
 *
 * Night Shift Logic:
 *   For shifts with crossesMidnight=true (e.g., 22:00→06:00):
 *   - Punches between shiftStart and midnight → attendance date = punch date
 *   - Punches between midnight and shiftEnd → attendance date = previous day
 *   - This anchors the entire work period to the date the shift STARTED
 */

import { prisma } from "@/lib/prisma";
import { getAdapter } from "./device-adapter";
import { differenceInMinutes, addDays, subDays } from "date-fns";

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

interface ShiftConfig {
    startTime: string;     // "HH:mm"
    endTime: string;       // "HH:mm"
    graceMinutes: number;
    crossesMidnight: boolean;
}

interface EmployeeWithShift {
    id: string;
    biometricUserId: string | null;
    shift: ShiftConfig | null;
}

// ── Shift-Aware Date Utilities ──────────────────────────────────────

/**
 * Parse "HH:mm" string into hours and minutes.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
    const [h, m] = timeStr.split(":").map(Number);
    return { hours: h || 0, minutes: m || 0 };
}

/**
 * Create a Date object from a base date + time string.
 */
function buildDateTime(baseDate: Date, timeStr: string): Date {
    const { hours, minutes } = parseTime(timeStr);
    const dt = new Date(baseDate);
    dt.setHours(hours, minutes, 0, 0);
    return dt;
}

/**
 * Determine the "shift date" — i.e., the attendance date — for a punch.
 *
 * For NORMAL shifts (crossesMidnight=false):
 *   → shift date = calendar date of the punch
 *
 * For NIGHT shifts (crossesMidnight=true, e.g., 22:00→06:00):
 *   → If punch time >= shiftStart (22:00) → shift date = punch date
 *   → If punch time < shiftEnd (06:00)   → shift date = punch date MINUS 1 day
 *   → Otherwise (between shiftEnd and shiftStart) → shift date = punch date (treated as out-of-shift)
 *
 * This ensures the entire night shift is grouped under the date it STARTED.
 */
function getShiftDate(punchTimestamp: Date, shift: ShiftConfig | null): Date {
    const shiftDate = new Date(punchTimestamp);
    shiftDate.setHours(0, 0, 0, 0);

    if (!shift || !shift.crossesMidnight) {
        return shiftDate; // Normal shift — use calendar date
    }

    const { hours: startH } = parseTime(shift.startTime);
    const { hours: endH, minutes: endM } = parseTime(shift.endTime);
    const punchH = punchTimestamp.getHours();
    const punchM = punchTimestamp.getMinutes();

    // Punch is after midnight but before shift end → belongs to PREVIOUS day's shift
    if (punchH < endH || (punchH === endH && punchM <= endM)) {
        return subDays(shiftDate, 1);
    }

    // Punch is at or after shift start → belongs to this day's shift
    if (punchH >= startH) {
        return shiftDate;
    }

    // Punch is between shift end and shift start (not during any shift window)
    // Default to calendar date
    return shiftDate;
}

/**
 * Calculate late minutes, early leave, and overtime for a shift — NIGHT-SHIFT-AWARE.
 */
function calculateShiftMetrics(
    checkIn: Date,
    checkOut: Date | null,
    shiftDate: Date,
    shift: ShiftConfig | null
): {
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    status: string;
} {
    const defaults = { lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, status: "present" };

    if (!shift) return defaults;

    // Build shift start datetime anchored to shiftDate
    const shiftStart = buildDateTime(shiftDate, shift.startTime);

    // Build shift end datetime — for night shifts, end is on the NEXT day
    let shiftEnd: Date;
    if (shift.crossesMidnight) {
        shiftEnd = buildDateTime(addDays(shiftDate, 1), shift.endTime);
    } else {
        shiftEnd = buildDateTime(shiftDate, shift.endTime);
    }

    // Calculate late minutes
    const graceEnd = new Date(shiftStart.getTime() + (shift.graceMinutes || 15) * 60000);
    let lateMinutes = 0;

    if (checkIn > graceEnd) {
        lateMinutes = differenceInMinutes(checkIn, shiftStart);
    }

    // Calculate early leave / overtime
    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;

    if (checkOut) {
        if (checkOut < shiftEnd) {
            earlyLeaveMinutes = differenceInMinutes(shiftEnd, checkOut);
            // Negative guard (shouldn't happen but defensive)
            earlyLeaveMinutes = Math.max(0, earlyLeaveMinutes);
        } else {
            overtimeMinutes = differenceInMinutes(checkOut, shiftEnd);
            overtimeMinutes = Math.max(0, overtimeMinutes);
        }
    }

    return {
        lateMinutes: Math.max(0, lateMinutes),
        earlyLeaveMinutes,
        overtimeMinutes,
        status: lateMinutes > 0 ? "present" : "present", // Late is still "present" — lateMinutes tracks severity
    };
}

// ── Main Sync Function ──────────────────────────────────────────────

/**
 * Sync a single biometric device: pull attendance logs,
 * map to employees, and create/update attendance records.
 *
 * Now with full night-shift awareness and failure classification.
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

    let recordsSynced = 0;
    let recordsSkipped = 0;
    let errorMessage: string | undefined;
    let retriable = true;

    try {
        // 2. Get the appropriate adapter for this device's brand
        let adapter;
        try {
            adapter = getAdapter(device.model);
        } catch {
            throw Object.assign(
                new Error(`Device brand "${device.model}" is not supported. Only ZKTeco devices are currently supported.`),
                { retriable: false }
            );
        }

        // 3. Connect to device
        const connResult = await adapter.connect(device.ip, device.port);
        if (!connResult.success) {
            throw Object.assign(
                new Error(`Connection failed: ${connResult.message}`),
                { retriable: true } // Network issue — worth retrying
            );
        }

        try {
            // 4. Pull attendance logs since last sync
            const syncResult = await adapter.getAttendanceLogs(
                device.lastSyncAt || undefined
            );

            if (!syncResult.success) {
                throw Object.assign(
                    new Error(syncResult.error || "Failed to fetch attendance logs"),
                    { retriable: true }
                );
            }

            // 5. Get employee mapping: biometricUserId → Employee (with shift config)
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
                            crossesMidnight: true,
                        },
                    },
                },
            });

            const employeeMap = new Map<string, EmployeeWithShift>();
            for (const emp of employees) {
                if (emp.biometricUserId) {
                    employeeMap.set(emp.biometricUserId, emp);
                }
            }

            // 6. Group logs by employee + SHIFT DATE (NOT calendar date)
            //    This is the critical fix for night shifts.
            const logsByUserShiftDate = new Map<string, { checkIn: Date; checkOut: Date | null; shiftDate: Date }>();

            for (const log of syncResult.logs) {
                const employee = employeeMap.get(log.id);
                if (!employee) {
                    recordsSkipped++;
                    continue;
                }

                // ✅ CRITICAL FIX: Use shift-aware date instead of calendar date
                const shiftDate = getShiftDate(log.timestamp, employee.shift);
                const dayKey = `${employee.id}|${shiftDate.toISOString()}`;

                if (!logsByUserShiftDate.has(dayKey)) {
                    logsByUserShiftDate.set(dayKey, {
                        checkIn: log.timestamp,
                        checkOut: null,
                        shiftDate,
                    });
                } else {
                    const existing = logsByUserShiftDate.get(dayKey)!;
                    // Earliest punch = check-in, latest punch = check-out
                    if (log.timestamp < existing.checkIn) {
                        existing.checkOut = existing.checkIn;
                        existing.checkIn = log.timestamp;
                    } else if (!existing.checkOut || log.timestamp > existing.checkOut) {
                        existing.checkOut = log.timestamp;
                    }
                }
            }

            // 7. Create/update attendance records
            for (const [dayKey, times] of logsByUserShiftDate) {
                const separatorIdx = dayKey.indexOf("|");
                const employeeId = dayKey.substring(0, separatorIdx);
                const shiftDate = times.shiftDate;

                // Calculate shift metrics (late, OT, early leave) — night-shift-aware
                const employee = employees.find((e) => e.id === employeeId);
                const metrics = calculateShiftMetrics(
                    times.checkIn,
                    times.checkOut,
                    shiftDate,
                    employee?.shift ?? null
                );

                try {
                    // Check existing record to determine best check-in
                    const existingRecord = await prisma.attendance.findUnique({
                        where: {
                            employeeId_date: { employeeId, date: shiftDate },
                        },
                        select: { checkIn: true, source: true },
                    });

                    // If existing record was manually entered, don't overwrite
                    if (existingRecord?.source === "manual") {
                        recordsSkipped++;
                        continue;
                    }

                    // Determine the best check-in: keep the earlier of existing vs biometric
                    let bestCheckIn = times.checkIn;
                    let bestLateMinutes = metrics.lateMinutes;

                    if (existingRecord?.checkIn && existingRecord.checkIn < times.checkIn) {
                        bestCheckIn = existingRecord.checkIn;
                        // Recalculate late with the earlier check-in
                        if (employee?.shift) {
                            const shiftStart = buildDateTime(shiftDate, employee.shift.startTime);
                            const graceEnd = new Date(shiftStart.getTime() + (employee.shift.graceMinutes || 15) * 60000);
                            bestLateMinutes = bestCheckIn > graceEnd
                                ? Math.max(0, differenceInMinutes(bestCheckIn, shiftStart))
                                : 0;
                        }
                    }

                    // Upsert — create if not exists, update with best values
                    await prisma.attendance.upsert({
                        where: {
                            employeeId_date: { employeeId, date: shiftDate },
                        },
                        create: {
                            employeeId,
                            date: shiftDate,
                            checkIn: times.checkIn,
                            checkOut: times.checkOut,
                            source: "biometric",
                            status: metrics.status,
                            lateMinutes: metrics.lateMinutes,
                            earlyLeaveMinutes: metrics.earlyLeaveMinutes,
                            overtimeMinutes: metrics.overtimeMinutes,
                            notes: `Synced from ${device.name}`,
                        },
                        update: {
                            checkIn: bestCheckIn,
                            lateMinutes: bestLateMinutes,
                            status: bestLateMinutes > 0 ? "present" : "present",
                            source: "biometric",
                            ...(times.checkOut
                                ? {
                                    checkOut: times.checkOut,
                                    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
                                    overtimeMinutes: metrics.overtimeMinutes,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        retriable = (error as any)?.retriable !== false;
    }

    const duration = Date.now() - startTime;
    const syncStatus = errorMessage ? "failed" : "success";

    // 8. Update device sync status + create sync log + update health
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
        console.error("[BIOMETRIC_SYNC] Failed to save sync log:", logError);
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
