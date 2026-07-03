/**
 * PeopleFlow Attendance Enhancement Engine
 *
 * Core module for auto-absence marking, geo-fencing validation,
 * and attendance regularization workflows.
 * 
 * ✅ Audit fixes applied:
 *  - Future date prevention in regularization
 *  - requestedStatus validation
 *  - Structured notes instead of fragile string concatenation
 */

import prisma from "@/lib/prisma";

// ============================================
// Auto-Mark Absent
// ============================================

export interface AutoAbsentResult {
    marked: number;
    skipped: number;
    errors: string[];
}

/**
 * Auto-mark absent for employees who didn't check in on a given date.
 * Should be called via cron job at end of each working day.
 */
export async function autoMarkAbsent(
    organizationId: string,
    date: Date
): Promise<AutoAbsentResult> {
    const result: AutoAbsentResult = { marked: 0, skipped: 0, errors: [] };

    // Skip weekends (Friday/Saturday for Bangladesh)
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 5 || dayOfWeek === 6) {
        return { ...result, skipped: -1 }; // -1 indicates weekend skip
    }

    // Get all active employees WITH their shift config
    const employees = await prisma.employee.findMany({
        where: { organizationId, employmentStatus: "active" },
        select: {
            id: true,
            shift: {
                select: {
                    crossesMidnight: true,
                    startTime: true,
                    endTime: true,
                },
            },
        },
    });

    if (employees.length === 0) return result;

    // ── Night Shift Awareness ──
    // Night shift workers (crossesMidnight=true) should NOT be auto-marked absent
    // on the date their shift STARTS, because their check-out comes the next calendar day.
    // Instead, they should be evaluated for the PREVIOUS day's shift.
    //
    // Example: Worker on 22:00→06:00 shift:
    //   - On March 15th, we check if they were absent for the March 14th night shift
    //   - NOT whether they checked in on March 15th (their shift hasn't started yet)
    //
    // Strategy: Split employees into two groups:
    //   1. Day shift workers → check attendance for today
    //   2. Night shift workers → check attendance for yesterday (their shift date)

    const dayShiftEmployees = employees.filter(
        (e) => !e.shift?.crossesMidnight
    );
    const nightShiftEmployees = employees.filter(
        (e) => e.shift?.crossesMidnight === true
    );

    // Process day shift employees (standard logic)
    const dayShiftIds = dayShiftEmployees.map((e) => e.id);
    if (dayShiftIds.length > 0) {
        await processAbsentBatch(dayShiftIds, date, result);
    }

    // Process night shift employees (check YESTERDAY's shift date)
    const nightShiftIds = nightShiftEmployees.map((e) => e.id);
    if (nightShiftIds.length > 0) {
        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        // Only process if yesterday wasn't a weekend
        const yesterdayDow = yesterday.getDay();
        if (yesterdayDow !== 5 && yesterdayDow !== 6) {
            await processAbsentBatch(nightShiftIds, yesterday, result);
        }
    }

    return result;
}

/**
 * Process auto-absent for a batch of employees on a specific date.
 * Shared logic between day-shift and night-shift processing.
 */
async function processAbsentBatch(
    employeeIds: string[],
    date: Date,
    result: AutoAbsentResult
): Promise<void> {
    // Get employees who already have attendance for this date
    const existingAttendance = await prisma.attendance.findMany({
        where: {
            date: {
                gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
            },
            employeeId: { in: employeeIds },
        },
        select: { employeeId: true },
    });

    const checkedInIds = new Set(existingAttendance.map((a) => a.employeeId));

    // Get employees on approved leave
    const onLeave = await prisma.leaveApplication.findMany({
        where: {
            status: "approved",
            fromDate: { lte: date },
            toDate: { gte: date },
            employeeId: { in: employeeIds },
        },
        select: { employeeId: true },
    });

    const onLeaveIds = new Set(onLeave.map((l) => l.employeeId));

    // Mark absent for employees who didn't check in and aren't on leave
    for (const employeeId of employeeIds) {
        if (checkedInIds.has(employeeId)) {
            result.skipped++;
            continue;
        }

        if (onLeaveIds.has(employeeId)) {
            try {
                await prisma.attendance.create({
                    data: {
                        date,
                        status: "on_leave",
                        source: "system",
                        employeeId,
                    },
                });
            } catch {
                // Unique constraint — already exists
            }
            result.skipped++;
            continue;
        }

        try {
            await prisma.attendance.create({
                data: {
                    date,
                    status: "absent",
                    source: "system",
                    notes: "Auto-marked absent — no check-in recorded",
                    employeeId,
                },
            });
            result.marked++;
        } catch (error) {
            result.errors.push(`Failed for employee ${employeeId}: ${error}`);
        }
    }
}

// ============================================
// Geo-Fencing Validation
// ============================================

interface GeoLocation {
    latitude: number;
    longitude: number;
}

interface GeoFenceResult {
    isWithinFence: boolean;
    distanceMeters: number;
    maxAllowedMeters: number;
}

/**
 * Validate if a check-in location is within the allowed geo-fence radius
 * of the office location using the Haversine formula.
 */
export function validateGeoFence(
    checkInLocation: GeoLocation,
    officeLocation: GeoLocation,
    radiusMeters: number = 200
): GeoFenceResult {
    // ✅ Validate inputs
    if (!isValidCoord(checkInLocation) || !isValidCoord(officeLocation)) {
        return {
            isWithinFence: false,
            distanceMeters: -1,
            maxAllowedMeters: radiusMeters,
        };
    }

    const distance = haversineDistance(
        checkInLocation.latitude,
        checkInLocation.longitude,
        officeLocation.latitude,
        officeLocation.longitude
    );

    return {
        isWithinFence: distance <= radiusMeters,
        distanceMeters: Math.round(distance),
        maxAllowedMeters: radiusMeters,
    };
}

function isValidCoord(loc: GeoLocation): boolean {
    return (
        typeof loc.latitude === "number" && !isNaN(loc.latitude) &&
        typeof loc.longitude === "number" && !isNaN(loc.longitude) &&
        loc.latitude >= -90 && loc.latitude <= 90 &&
        loc.longitude >= -180 && loc.longitude <= 180
    );
}

/**
 * Haversine formula: calculates distance between two lat/lng points
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

// ============================================
// Valid Attendance Statuses
// ============================================

// IMPORTANT: These MUST match the Attendance.status field's allowed values
// in prisma/schema.prisma. The schema comment reads:
//   "present, absent, half_day, on_leave, holiday, weekend"
// "late" is NOT a valid status — late employees are stored as
// status="present" with lateMinutes > 0. Reports that need to identify
// late employees must filter on lateMinutes > 0.
const VALID_STATUSES = [
    "present",
    "absent",
    "half_day",
    "on_leave",
    "holiday",
    "weekend",
] as const;
type AttendanceStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(status: string): status is AttendanceStatus {
    return VALID_STATUSES.includes(status as AttendanceStatus);
}

// ============================================
// Attendance Regularization
// ============================================

export interface RegularizationRequest {
    attendanceId?: string;
    employeeId: string;
    date: Date;
    requestedStatus: string;
    requestedCheckIn?: Date;
    requestedCheckOut?: Date;
    reason: string;
}

export interface RegularizationResult {
    success: boolean;
    message: string;
}

/**
 * Submit an attendance regularization request.
 * This creates/updates the attendance record with a "pending_regularization" flag.
 */
export async function submitRegularization(
    request: RegularizationRequest
): Promise<RegularizationResult> {
    try {
        // ✅ Validate requested status
        if (!isValidStatus(request.requestedStatus)) {
            return {
                success: false,
                message: `Invalid status "${request.requestedStatus}". Must be one of: ${VALID_STATUSES.join(", ")}`,
            };
        }

        // ✅ Prevent regularization for future dates
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (request.date > today) {
            return {
                success: false,
                message: "Cannot submit regularization for future dates.",
            };
        }

        const dateStart = new Date(request.date);
        dateStart.setHours(0, 0, 0, 0);

        // ✅ Build structured notes (easier to parse than raw string concatenation)
        const regularizationData = {
            status: "PENDING",
            reason: request.reason,
            requestedStatus: request.requestedStatus,
            requestedCheckIn: request.requestedCheckIn?.toISOString(),
            requestedCheckOut: request.requestedCheckOut?.toISOString(),
            submittedAt: new Date().toISOString(),
        };
        const notesStr = `[REGULARIZATION] ${JSON.stringify(regularizationData)}`;

        // Check if attendance record exists
        const existing = await prisma.attendance.findFirst({
            where: {
                employeeId: request.employeeId,
                date: dateStart,
            },
        });

        if (existing) {
            await prisma.attendance.update({
                where: { id: existing.id },
                data: { notes: notesStr },
            });
        } else {
            // Create a placeholder attendance row so the regularization
            // request has something to attach to. Status is "absent" until
            // the regularization is approved (which will set the real
            // status). "pending" is NOT a valid schema status — see
            // VALID_STATUSES above.
            await prisma.attendance.create({
                data: {
                    date: dateStart,
                    employeeId: request.employeeId,
                    status: "absent",
                    source: "regularization",
                    notes: notesStr,
                },
            });
        }

        return {
            success: true,
            message: "Regularization request submitted. Pending manager approval.",
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to submit regularization: ${error}`,
        };
    }
}

/**
 * Approve or reject a regularization request
 */
export async function processRegularization(
    attendanceId: string,
    action: "approve" | "reject",
    processedBy: string,
    requestedStatus?: string,
    requestedCheckIn?: Date,
    requestedCheckOut?: Date
): Promise<RegularizationResult> {
    try {
        const attendance = await prisma.attendance.findUnique({
            where: { id: attendanceId },
        });

        if (!attendance) {
            return { success: false, message: "Attendance record not found" };
        }

        if (action === "approve" && requestedStatus) {
            // ✅ Validate the requested status before applying
            if (!isValidStatus(requestedStatus)) {
                return {
                    success: false,
                    message: `Invalid status "${requestedStatus}". Must be one of: ${VALID_STATUSES.join(", ")}`,
                };
            }

            await prisma.attendance.update({
                where: { id: attendanceId },
                data: {
                    status: requestedStatus,
                    checkIn: requestedCheckIn || attendance.checkIn,
                    checkOut: requestedCheckOut || attendance.checkOut,
                    notes: `[REGULARIZED] Approved by ${processedBy} on ${new Date().toISOString()}`,
                },
            });
        } else if (action === "reject") {
            await prisma.attendance.update({
                where: { id: attendanceId },
                data: {
                    notes: `[REGULARIZATION REJECTED] by ${processedBy} on ${new Date().toISOString()}`,
                },
            });
        }

        return {
            success: true,
            message: `Regularization ${action}ed successfully.`,
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to process regularization: ${error}`,
        };
    }
}
