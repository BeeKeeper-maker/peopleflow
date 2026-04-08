import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { apiLogger } from "@/lib/logger";

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

async function authenticateAgent(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return null;
    }

    const rawKey = authHeader.substring(7);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await prisma.syncApiKey.findUnique({
        where: { key: keyHash },
        include: {
            organization: {
                select: { id: true, name: true, timezone: true },
            },
        },
    });

    if (!apiKey || !apiKey.isActive || apiKey.revokedAt) {
        return null;
    }

    return apiKey;
}

export async function POST(req: Request) {
    try {
        // 1. Authenticate via API Key
        const apiKey = await authenticateAgent(req);
        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "Invalid or revoked API key" },
                { status: 401 }
            );
        }

        const body = await req.json();
        const records: PunchRecord[] = body.records;

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

            // Group key: employeeId + date (YYYY-MM-DD)
            const dateKey = ts.toISOString().split("T")[0];
            const groupKey = `${employee.id}::${dateKey}`;

            if (!punchGroups.has(groupKey)) {
                punchGroups.set(groupKey, { employee, punches: [] });
            }
            punchGroups.get(groupKey)!.punches.push(ts);
        }

        // 4. Create/update attendance records
        for (const [groupKey, group] of punchGroups.entries()) {
            const [employeeId, dateStr] = groupKey.split("::");
            const attendanceDate = new Date(dateStr + "T00:00:00.000Z");

            // Sort punches chronologically
            group.punches.sort((a, b) => a.getTime() - b.getTime());

            const firstPunch = group.punches[0];
            const lastPunch = group.punches.length > 1
                ? group.punches[group.punches.length - 1]
                : null;

            // Calculate late minutes if shift configured
            let lateMinutes = 0;
            let earlyLeaveMinutes = 0;
            let overtimeMinutes = 0;

            const shift = group.employee.shift;
            if (shift) {
                const [startH, startM] = shift.startTime.split(":").map(Number);
                const shiftStart = new Date(firstPunch);
                shiftStart.setHours(startH, startM, 0, 0);

                const diffMin = Math.round(
                    (firstPunch.getTime() - shiftStart.getTime()) / 60000
                );
                lateMinutes = Math.max(0, diffMin - (shift.graceMinutes || 0));

                if (lastPunch) {
                    const [endH, endM] = shift.endTime.split(":").map(Number);
                    const shiftEnd = new Date(lastPunch);
                    shiftEnd.setHours(endH, endM, 0, 0);

                    const endDiff = Math.round(
                        (lastPunch.getTime() - shiftEnd.getTime()) / 60000
                    );
                    if (endDiff < 0) {
                        earlyLeaveMinutes = Math.abs(endDiff);
                    } else {
                        overtimeMinutes = endDiff;
                    }
                }
            }

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

        // 5. Update API key stats
        await prisma.syncApiKey.update({
            where: { id: apiKey.id },
            data: {
                lastSyncAt: new Date(),
                agentIp,
                agentVersion: body.agentVersion || apiKey.agentVersion,
                syncCount: { increment: 1 },
                totalRecords: { increment: synced },
            },
        });

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
