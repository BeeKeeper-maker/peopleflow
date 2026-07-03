/**
 * PeopleFlow Biometric Punch Processor — CANONICAL IMPLEMENTATION
 *
 * This is the SINGLE source of truth for converting biometric punches into
 * Attendance records. All three ingestion paths MUST use this module:
 *
 *   1. Sync Agent push  → /api/v1/sync/push
 *   2. ADMS/iClock push → /iclock/cdata (via lib/biometric/adms.ts)
 *   3. Cloud-pull sync  → lib/biometric/sync-engine.ts (legacy, only for direct-cloud)
 *
 * Why this exists:
 *   Previously there were THREE separate implementations with subtly different
 *   timezone handling, overwrite semantics, and error behaviour. That caused:
 *     - punches landing on the wrong calendar day (TZ skew)
 *     - partial batches overwriting earlier check-ins
 *     - inconsistent late/early/OT calculations
 *
 * This module fixes all three by:
 *   ✅ Using Asia/Dhaka (UTC+6) consistently for shift-date determination
 *   ✅ Merging with existing records (min check-in, max check-out) — never overwrites
 *   ✅ Respecting manual entries (source === "manual" is never overwritten)
 *   ✅ Single calculateShiftMetrics implementation
 *
 * Idempotency:
 *   Re-processing the same punch is SAFE. The merge logic takes
 *   min(existing.checkIn, new.checkIn) and max(existing.checkOut, new.checkOut).
 *   So a re-sync after a network blip will not corrupt data.
 *
 * Future: A raw BiometricPunch ledger table will make this even more robust,
 * but the merge logic here is sufficient for production today.
 */

import { prisma } from "@/lib/prisma";
import { biometricLogger } from "@/lib/logger";

// ── Types ────────────────────────────────────────────────────────────

export interface BiometricPunchRecord {
    /** Device-assigned user ID (maps to Employee.biometricUserId) */
    userId: string;
    /** ISO-8601 timestamp of the punch */
    timestamp: string;
    /** Optional punch type: 0=checkIn, 1=checkOut (ZKTeco convention) */
    type?: number;
    /** Optional device state code */
    state?: number;
    /** Optional device serial number (for audit trail) */
    serialNumber?: string;
}

interface ShiftConfig {
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
    graceMinutes: number;
    crossesMidnight: boolean;
}

interface EmployeeWithShift {
    id: string;
    biometricUserId: string | null;
    shift: ShiftConfig | null;
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

// ── Bangladesh Timezone Constants ────────────────────────────────────

/**
 * Bangladesh Standard Time = UTC+6.
 * We hard-code this offset rather than relying on Intl.DateTimeFormat
 * because the server may run in UTC (Docker default) and we need
 * deterministic business-day anchoring.
 *
 * If PeopleFlow ever expands to other timezones, this should become
 * per-Organization (read from Organization.timezone). For now, the
 * product is Bangladesh-only.
 */
export const BUSINESS_TIMEZONE_OFFSET_MINUTES = 6 * 60;

/**
 * Convert a Date to the business-local (Asia/Dhaka) Date.
 * Returns a new Date object; does not mutate the input.
 *
 * IMPORTANT: This returns a Date whose UTC fields represent the
 * local time. So if the input is 2026-01-15T19:00:00Z (UTC),
 * the output's UTC fields will be 2026-01-16T01:00:00 (BD local).
 * Use getUTC* methods on the result to read the local time.
 */
export function getBusinessLocalDate(date: Date): Date {
    return new Date(date.getTime() + BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
}

/**
 * Get the start of the business-local calendar day for a given timestamp.
 *
 * Returns a Date at UTC midnight for the business-local calendar day.
 * Example: input 2026-01-15T19:00:00Z (BD time 2026-01-16T01:00)
 *          → output 2026-01-16T00:00:00Z
 *
 * This is the canonical "attendance date" stored in Attendance.date.
 */
export function startOfBusinessDay(date: Date): Date {
    const local = getBusinessLocalDate(date);
    return new Date(
        Date.UTC(
            local.getUTCFullYear(),
            local.getUTCMonth(),
            local.getUTCDate(),
            0,
            0,
            0,
            0,
        ),
    );
}

/**
 * Add (or subtract) business days from a Date.
 * Returns a new Date; does not mutate the input.
 */
export function addBusinessDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

/**
 * Build a UTC Date from a business-local base date + "HH:mm" time string.
 *
 * Example: baseDate = 2026-01-16T00:00:00Z, time = "09:00"
 *          → 2026-01-16T03:00:00Z (which is 09:00 BD time)
 */
export function buildBusinessDateTime(baseBusinessDate: Date, timeStr: string): Date {
    const [h, m] = timeStr.split(":").map(Number);
    const hours = Number.isFinite(h) ? h : 0;
    const minutes = Number.isFinite(m) ? m : 0;
    const utcMs =
        Date.UTC(
            baseBusinessDate.getUTCFullYear(),
            baseBusinessDate.getUTCMonth(),
            baseBusinessDate.getUTCDate(),
            hours,
            minutes,
            0,
            0,
        ) -
        BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000;
    return new Date(utcMs);
}

/**
 * Parse "HH:mm" string into hours and minutes.
 * Returns { hours: 0, minutes: 0 } for invalid input.
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
    const [h, m] = (timeStr || "00:00").split(":").map(Number);
    return {
        hours: Number.isFinite(h) ? h : 0,
        minutes: Number.isFinite(m) ? m : 0,
    };
}

/**
 * Determine the "shift date" (attendance date) for a punch.
 *
 * For NORMAL shifts (crossesMidnight=false):
 *   → shift date = calendar date of the punch (business-local)
 *
 * For NIGHT shifts (crossesMidnight=true, e.g., 22:00→06:00):
 *   → If punch time >= shiftStart (22:00) → shift date = punch date
 *   → If punch time < shiftEnd (06:00)    → shift date = punch date MINUS 1 day
 *   → Otherwise (between shiftEnd and shiftStart) → shift date = punch date
 *
 * This anchors the entire night shift to the date it STARTED,
 * so a worker who punches in at 22:00 Mon and out at 06:00 Tue
 * gets a single attendance record for Mon.
 */
export function getShiftDate(punchTimestamp: Date, shift: ShiftConfig | null): Date {
    const shiftDate = startOfBusinessDay(punchTimestamp);
    if (!shift || !shift.crossesMidnight) return shiftDate;

    const { hours: startH } = parseTime(shift.startTime);
    const { hours: endH, minutes: endM } = parseTime(shift.endTime);
    const localPunch = getBusinessLocalDate(punchTimestamp);
    const punchH = localPunch.getUTCHours();
    const punchM = localPunch.getUTCMinutes();

    // Punch is after midnight but before shift end → belongs to PREVIOUS day's shift
    if (punchH < endH || (punchH === endH && punchM <= endM)) {
        return addBusinessDays(shiftDate, -1);
    }
    // Punch is at or after shift start → belongs to this day's shift
    if (punchH >= startH) return shiftDate;
    // Punch is between shift end and shift start (not during any shift window)
    return shiftDate;
}

/**
 * Calculate late minutes, early leave, and overtime for a shift.
 * Night-shift-aware (shift end is on the next day if crossesMidnight).
 *
 * Returns all values as non-negative integers (minutes).
 */
export function calculateShiftMetrics(
    checkIn: Date,
    checkOut: Date | null,
    shiftDate: Date,
    shift: ShiftConfig | null,
): {
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
} {
    if (!shift) {
        return { lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 };
    }

    const shiftStart = buildBusinessDateTime(shiftDate, shift.startTime);
    const shiftEnd = buildBusinessDateTime(
        shift.crossesMidnight ? addBusinessDays(shiftDate, 1) : shiftDate,
        shift.endTime,
    );
    const graceMinutes = Math.max(0, shift.graceMinutes || 0);

    // Late = minutes past (shiftStart + grace), rounded, non-negative
    const lateMs = checkIn.getTime() - (shiftStart.getTime() + graceMinutes * 60_000);
    const lateMinutes = lateMs > 0 ? Math.round(lateMs / 60_000) : 0;

    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;

    if (checkOut) {
        const endDiffMs = checkOut.getTime() - shiftEnd.getTime();
        if (endDiffMs < 0) {
            earlyLeaveMinutes = Math.round(Math.abs(endDiffMs) / 60_000);
        } else {
            overtimeMinutes = Math.round(endDiffMs / 60_000);
        }
    }

    return {
        lateMinutes: Math.max(0, lateMinutes),
        earlyLeaveMinutes: Math.max(0, earlyLeaveMinutes),
        overtimeMinutes: Math.max(0, overtimeMinutes),
    };
}

// ── Employee Map Builder ─────────────────────────────────────────────

/**
 * Build a map of biometricUserId → EmployeeWithShift for an organization.
 * Only returns active (non-deleted) employees with a biometricUserId set.
 */
export async function buildEmployeeBiometricMap(
    organizationId: string,
): Promise<Map<string, EmployeeWithShift>> {
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

    const map = new Map<string, EmployeeWithShift>();
    for (const emp of employees) {
        if (emp.biometricUserId) {
            map.set(emp.biometricUserId, emp as EmployeeWithShift);
        }
    }
    return map;
}

// ── Canonical Punch Ingestion ────────────────────────────────────────

/**
 * Ingest a batch of biometric punches and create/update Attendance records.
 *
 * This is the CANONICAL implementation. All ingestion paths (sync agent,
 * ADMS, cloud-pull) must call this function — do NOT re-implement punch
 * processing inline.
 *
 * Merge semantics (idempotent):
 *   - If no existing Attendance row → CREATE with the punches in this batch.
 *   - If an existing row exists AND source !== "manual":
 *       checkIn    = min(existing.checkIn,    new.checkIn)
 *       checkOut   = max(existing.checkOut,   new.checkOut)
 *       late/early/OT = recalculated from the merged check-in/out
 *   - If an existing row exists AND source === "manual" → SKIP (don't overwrite
 *     a manual entry with biometric data). The punch is counted as "skipped".
 *
 * @param params.organizationId  The tenant this data belongs to.
 * @param params.records         Array of punch records from the device/agent.
 * @param params.source          Optional source tag (defaults to "biometric").
 *                               Use "biometric" for agent/ADMS/cloud-pull.
 * @param params.deviceId        Optional device ID for audit trail (written to notes).
 * @param params.deviceName      Optional device name for audit trail.
 * @returns BiometricIngestResult with counts and any errors.
 */
export async function ingestBiometricPunches(params: {
    organizationId: string;
    records: BiometricPunchRecord[];
    source?: string;
    deviceId?: string;
    deviceName?: string;
}): Promise<BiometricIngestResult> {
    const { organizationId, records } = params;
    const source = params.source || "biometric";
    const auditNote = params.deviceName
        ? `Synced from ${params.deviceName}`
        : undefined;

    if (!records || records.length === 0) {
        return {
            received: 0,
            synced: 0,
            skipped: 0,
            unmappedUsers: 0,
            unmappedUserIds: [],
            attendanceDays: 0,
        };
    }

    // 1. Build employee map (cached lookup by biometricUserId)
    const employeeMap = await buildEmployeeBiometricMap(organizationId);

    // 2. Group punches by (employeeId, shiftDate)
    //    Within each group, collect all punches so we can pick the earliest
    //    as check-in and the latest as check-out.
    const punchGroups = new Map<
        string,
        { employee: EmployeeWithShift; punches: Date[] }
    >();

    let skipped = 0;
    let unmappedUsers = 0;
    const unmappedIds = new Set<string>();

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
        const existing = punchGroups.get(groupKey);
        if (existing) {
            existing.punches.push(ts);
        } else {
            punchGroups.set(groupKey, { employee, punches: [ts] });
        }
    }

    // 3. Upsert each group into Attendance, MERGING with any existing record
    let synced = 0;
    const errors: string[] = [];

    for (const [groupKey, group] of punchGroups.entries()) {
        const [employeeId, dateStr] = groupKey.split("::");
        const attendanceDate = new Date(dateStr);

        // Sort punches chronologically
        group.punches.sort((a, b) => a.getTime() - b.getTime());

        const newCheckIn = group.punches[0];
        const newCheckOut =
            group.punches.length > 1
                ? group.punches[group.punches.length - 1]
                : null;

        try {
            // Fetch existing record to determine merge behavior
            const existingRecord = await prisma.attendance.findUnique({
                where: {
                    employeeId_date: { employeeId, date: attendanceDate },
                },
                select: {
                    checkIn: true,
                    checkOut: true,
                    source: true,
                    notes: true,
                },
            });

            // Never overwrite a manual entry with biometric data
            if (existingRecord?.source === "manual") {
                skipped++;
                continue;
            }

            // Merge: take the earliest check-in and latest check-out
            let bestCheckIn = newCheckIn;
            let bestCheckOut = newCheckOut;

            if (existingRecord) {
                if (existingRecord.checkIn && existingRecord.checkIn < bestCheckIn) {
                    bestCheckIn = existingRecord.checkIn;
                }
                if (existingRecord.checkOut) {
                    if (!bestCheckOut || existingRecord.checkOut > bestCheckOut) {
                        bestCheckOut = existingRecord.checkOut;
                    }
                }
            }

            // Recalculate metrics from the merged check-in/out
            const { lateMinutes, earlyLeaveMinutes, overtimeMinutes } =
                calculateShiftMetrics(
                    bestCheckIn,
                    bestCheckOut,
                    attendanceDate,
                    group.employee.shift,
                );

            await prisma.attendance.upsert({
                where: {
                    employeeId_date: { employeeId, date: attendanceDate },
                },
                create: {
                    employeeId,
                    date: attendanceDate,
                    checkIn: bestCheckIn,
                    checkOut: bestCheckOut,
                    status: "present",
                    source,
                    lateMinutes,
                    earlyLeaveMinutes,
                    overtimeMinutes,
                    ...(auditNote ? { notes: auditNote } : {}),
                },
                update: {
                    checkIn: bestCheckIn,
                    // NEVER set checkOut to undefined — that would delete a
                    // previously-known check-out. Only update if we have one.
                    ...(bestCheckOut ? { checkOut: bestCheckOut } : {}),
                    source,
                    lateMinutes,
                    earlyLeaveMinutes,
                    overtimeMinutes,
                    ...(auditNote ? { notes: auditNote } : {}),
                },
            });
            synced++;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${groupKey}: ${msg}`);
            skipped++;
            biometricLogger.error(
                { err, employeeId, date: attendanceDate.toISOString() },
                "Punch upsert failed",
            );
        }
    }

    return {
        received: records.length,
        synced,
        skipped,
        unmappedUsers,
        unmappedUserIds: Array.from(unmappedIds),
        attendanceDays: punchGroups.size,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    };
}
