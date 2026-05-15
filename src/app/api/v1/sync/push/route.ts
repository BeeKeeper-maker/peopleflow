import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";
import { authenticateSyncAgent } from "@/lib/sync-agent-auth";

/**
 * POST /api/v1/sync/push — Cloud Ingest Endpoint
 *
 * Receives attendance punch data from the PeopleFlow Sync Agent.
 * Authenticated via Bearer token (SyncApiKey).
 *
 * Body: {
 *   deviceSerial?: string,
 *   records: [{ userId: string, timestamp: string, type?: number }]
 * }
 *
 * The engine:
 *   1. Validates API key
 *   2. Maps device userIds → employees via biometricUserId
 *   3. Creates/updates Attendance records with shift-aware logic
 *   4. Returns summary of processed records
 */

interface PunchRecord {
    userId: string;
    timestamp: string;
    type?: number; // 0=checkIn, 1=checkOut (ZKTeco convention)
}

interface ShiftConfig {
    startTime: string;
    endTime: string;
    graceMinutes: number;
    crossesMidnight: boolean;
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
    const [h, m] = timeStr.split(":").map(Number);
    return { hours: h || 0, minutes: m || 0 };
}

function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function buildDateTime(baseDate: Date, timeStr: string): Date {
    const { hours, minutes } = parseTime(timeStr);
    const d = new Date(baseDate);
    d.setHours(hours, minutes, 0, 0);
    return d;
}

function getShiftDate(punchTimestamp: Date, shift: ShiftConfig | null): Date {
    const shiftDate = startOfDay(punchTimestamp);
    if (!shift || !shift.crossesMidnight) return shiftDate;

    const { hours: startH } = parseTime(shift.startTime);
    const { hours: endH, minutes: endM } = parseTime(shift.endTime);
    const punchH = punchTimestamp.getHours();
    const punchM = punchTimestamp.getMinutes();

    if (punchH < endH || (punchH === endH && punchM <= endM)) {
        return addDays(shiftDate, -1);
    }
    if (punchH >= startH) return shiftDate;
    return shiftDate;
}

function diffMinutes(a: Date, b: Date): number {
    return Math.round((a.getTime() - b.getTime()) / 60000);
}

function calculateShiftMetrics(checkIn: Date, checkOut: Date | null, shiftDate: Date, shift: ShiftConfig | null) {
    if (!shift) return { lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 };

    const shiftStart = buildDateTime(shiftDate, shift.startTime);
    const shiftEnd = buildDateTime(shift.crossesMidnight ? addDays(shiftDate, 1) : shiftDate, shift.endTime);
    const graceMinutes = shift.graceMinutes || 0;

    const lateMinutes = Math.max(0, diffMinutes(checkIn, shiftStart) - graceMinutes);
    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;

    if (checkOut) {
        const endDiff = diffMinutes(checkOut, shiftEnd);
        if (endDiff < 0) earlyLeaveMinutes = Math.abs(endDiff);
        else overtimeMinutes = endDiff;
    }

    return { lateMinutes, earlyLeaveMinutes, overtimeMinutes };
}

export async function POST(req: Request) {
    try {
        // 1. Authenticate via API Key
        const auth = await authenticateSyncAgent(req);
        if (!auth.valid) return auth.response;
        const { apiKey } = auth;

        const body = await req.json();
        const records: PunchRecord[] = body.records;
        const deviceIp = typeof body.deviceIp === "string" ? body.deviceIp.trim() : null;
        const devicePort = Number(body.devicePort) || 4370;

        if (!records || !Array.isArray(records) || records.length === 0) {
            return NextResponse.json(
                { success: false, error: "No records provided" },
                { status: 400 }
            );
        }

        const agentIp =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            "unknown";

        // 2. Get employee map: biometricUserId → employee
        const employees = await prisma.employee.findMany({
            where: {
                organizationId: apiKey.organizationId,
                biometricUserId: { not: null },
                deletedAt: null,
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

        const employeeMap = new Map<string, (typeof employees)[0]>();
        for (const emp of employees) {
            if (emp.biometricUserId) {
                employeeMap.set(emp.biometricUserId, emp);
            }
        }

        // 3. Process records
        let synced = 0;
        let skipped = 0;
        let unmappedUsers = 0;
        const errors: string[] = [];
        const unmappedIds = new Set<string>();

        // Group punches by employee+date for smart check-in/check-out detection
        const punchGroups = new Map<string, { employee: (typeof employees)[0]; punches: Date[] }>();

        for (const record of records) {
            const employee = employeeMap.get(String(record.userId));
            if (!employee) {
                unmappedIds.add(String(record.userId));
                unmappedUsers++;
                continue;
            }

            const ts = new Date(record.timestamp);
            if (isNaN(ts.getTime())) {
                skipped++;
                continue;
            }

            // Group key: employeeId + shift-aware attendance date
            const attendanceDateForPunch = getShiftDate(ts, employee.shift);
            const dateKey = attendanceDateForPunch.toISOString();
            const groupKey = `${employee.id}::${dateKey}`;

            if (!punchGroups.has(groupKey)) {
                punchGroups.set(groupKey, { employee, punches: [] });
            }
            punchGroups.get(groupKey)!.punches.push(ts);
        }

        // 4. Create/update attendance records
        for (const [groupKey, group] of punchGroups.entries()) {
            const [employeeId, dateStr] = groupKey.split("::");
            const attendanceDate = new Date(dateStr);

            // Sort punches chronologically
            group.punches.sort((a, b) => a.getTime() - b.getTime());

            const firstPunch = group.punches[0];
            const lastPunch = group.punches.length > 1
                ? group.punches[group.punches.length - 1]
                : null;

            // Calculate shift-aware late / early leave / overtime metrics
            const { lateMinutes, earlyLeaveMinutes, overtimeMinutes } = calculateShiftMetrics(
                firstPunch,
                lastPunch,
                attendanceDate,
                group.employee.shift
            );

            try {
                await prisma.attendance.upsert({
                    where: {
                        employeeId_date: {
                            employeeId,
                            date: attendanceDate,
                        },
                    },
                    create: {
                        employeeId,
                        date: attendanceDate,
                        checkIn: firstPunch,
                        checkOut: lastPunch,
                        status: "present",
                        source: "biometric",
                        lateMinutes,
                        earlyLeaveMinutes,
                        overtimeMinutes,
                    },
                    update: {
                        checkIn: firstPunch,
                        checkOut: lastPunch || undefined,
                        source: "biometric",
                        lateMinutes,
                        earlyLeaveMinutes,
                        overtimeMinutes,
                    },
                });
                synced++;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                errors.push(`${groupKey}: ${msg}`);
                skipped++;
            }
        }

        // 5. Update API key stats and matching device card/history when possible
        const syncedAt = new Date();
        await prisma.syncApiKey.update({
            where: { id: apiKey.id },
            data: {
                lastSyncAt: syncedAt,
                agentIp,
                agentVersion: body.agentVersion || apiKey.agentVersion,
                syncCount: { increment: 1 },
                totalRecords: { increment: synced },
            },
        });

        if (deviceIp) {
            const device = await prisma.biometricDevice.findFirst({
                where: {
                    organizationId: apiKey.organizationId,
                    ip: deviceIp,
                    port: devicePort,
                },
                select: { id: true },
            });

            if (device) {
                const status = errors.length > 0 || unmappedUsers > 0 ? "partial" : "success";
                await prisma.biometricDevice.update({
                    where: { id: device.id },
                    data: {
                        lastSyncAt: syncedAt,
                        lastSyncStatus: status,
                        isOnline: true,
                        lastPingAt: syncedAt,
                        consecutiveFailures: 0,
                    },
                });

                await prisma.deviceSyncLog.create({
                    data: {
                        deviceId: device.id,
                        status,
                        recordsSynced: synced,
                        recordsSkipped: skipped + unmappedUsers,
                        errorMessage: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
                        syncDuration: null,
                    },
                });
            }
        }

        return NextResponse.json({
            success: true,
            summary: {
                received: records.length,
                synced,
                skipped,
                unmappedUsers,
                unmappedUserIds: Array.from(unmappedIds),
                attendanceDays: punchGroups.size,
                errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        apiLogger.error({ err: error }, "SYNC_PUSH_ERROR");
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
