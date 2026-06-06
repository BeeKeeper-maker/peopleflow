import { prisma } from "@/lib/prisma";

export interface BiometricPunchRecord {
    userId: string;
    timestamp: string;
    type?: number;
    state?: number;
    serialNumber?: string;
}

interface ShiftConfig {
    startTime: string;
    endTime: string;
    graceMinutes: number;
    crossesMidnight: boolean;
}

export interface BiometricIngestResult {
    received: number;
    synced: number;
    skipped: number;
    unmappedUsers: number;
    unmappedUserIds: string[];
    attendanceDays: number;
    errors?: string[];
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
    const [h, m] = timeStr.split(":").map(Number);
    return { hours: h || 0, minutes: m || 0 };
}

const BUSINESS_TIMEZONE_OFFSET_MINUTES = 6 * 60; // Bangladesh / Asia-Dhaka

function getBusinessLocalDate(date: Date): Date {
    return new Date(date.getTime() + BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
}

export function startOfBusinessDay(date: Date): Date {
    const local = getBusinessLocalDate(date);
    // Store attendance.date as UTC midnight for the business-local calendar day.
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0, 0));
}

export function addBusinessDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

export function buildBusinessDateTime(baseBusinessDate: Date, timeStr: string): Date {
    const { hours, minutes } = parseTime(timeStr);
    const utcMs = Date.UTC(
        baseBusinessDate.getUTCFullYear(),
        baseBusinessDate.getUTCMonth(),
        baseBusinessDate.getUTCDate(),
        hours,
        minutes,
        0,
        0
    ) - BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000;
    return new Date(utcMs);
}

function getShiftDate(punchTimestamp: Date, shift: ShiftConfig | null): Date {
    const shiftDate = startOfBusinessDay(punchTimestamp);
    if (!shift || !shift.crossesMidnight) return shiftDate;

    const { hours: startH } = parseTime(shift.startTime);
    const { hours: endH, minutes: endM } = parseTime(shift.endTime);
    const localPunch = getBusinessLocalDate(punchTimestamp);
    const punchH = localPunch.getUTCHours();
    const punchM = localPunch.getUTCMinutes();

    if (punchH < endH || (punchH === endH && punchM <= endM)) return addBusinessDays(shiftDate, -1);
    if (punchH >= startH) return shiftDate;
    return shiftDate;
}

function diffMinutes(a: Date, b: Date): number {
    return Math.round((a.getTime() - b.getTime()) / 60000);
}

function calculateShiftMetrics(checkIn: Date, checkOut: Date | null, shiftDate: Date, shift: ShiftConfig | null) {
    if (!shift) return { lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 };

    const shiftStart = buildBusinessDateTime(shiftDate, shift.startTime);
    const shiftEnd = buildBusinessDateTime(shift.crossesMidnight ? addBusinessDays(shiftDate, 1) : shiftDate, shift.endTime);
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

export async function ingestBiometricPunches(params: {
    organizationId: string;
    records: BiometricPunchRecord[];
}): Promise<BiometricIngestResult> {
    const { organizationId, records } = params;

    const employees = await prisma.employee.findMany({
        where: {
            organizationId,
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
        if (emp.biometricUserId) employeeMap.set(emp.biometricUserId, emp);
    }

    let synced = 0;
    let skipped = 0;
    let unmappedUsers = 0;
    const errors: string[] = [];
    const unmappedIds = new Set<string>();
    const punchGroups = new Map<string, { employee: (typeof employees)[0]; punches: Date[] }>();

    for (const record of records) {
        const userId = String(record.userId || "").trim();
        if (!userId) {
            skipped++;
            continue;
        }

        const employee = employeeMap.get(userId);
        if (!employee) {
            unmappedIds.add(userId);
            unmappedUsers++;
            continue;
        }

        const ts = new Date(record.timestamp);
        if (Number.isNaN(ts.getTime())) {
            skipped++;
            continue;
        }

        const attendanceDateForPunch = getShiftDate(ts, employee.shift);
        const groupKey = `${employee.id}::${attendanceDateForPunch.toISOString()}`;
        if (!punchGroups.has(groupKey)) punchGroups.set(groupKey, { employee, punches: [] });
        punchGroups.get(groupKey)!.punches.push(ts);
    }

    for (const [groupKey, group] of punchGroups.entries()) {
        const [employeeId, dateStr] = groupKey.split("::");
        const attendanceDate = new Date(dateStr);
        group.punches.sort((a, b) => a.getTime() - b.getTime());

        const firstPunch = group.punches[0];
        const lastPunch = group.punches.length > 1 ? group.punches[group.punches.length - 1] : null;
        const { lateMinutes, earlyLeaveMinutes, overtimeMinutes } = calculateShiftMetrics(
            firstPunch,
            lastPunch,
            attendanceDate,
            group.employee.shift
        );

        try {
            await prisma.attendance.upsert({
                where: { employeeId_date: { employeeId, date: attendanceDate } },
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

    return {
        received: records.length,
        synced,
        skipped,
        unmappedUsers,
        unmappedUserIds: Array.from(unmappedIds),
        attendanceDays: punchGroups.size,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    };
}
