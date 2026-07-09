import { NextResponse } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { manualAttendanceSchema } from "@/lib/validations/attendance";
import { buildBusinessDateTime, startOfBusinessDay } from "@/lib/biometric/punch-processor";
import { attendanceLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";

/**
 * POST /api/attendance/manual — HR/Admin manually create or update an attendance record
 *
 * Use cases:
 *   - Employee forgot to check in (HR adds present/absent manually)
 *   - Device was down for a day (HR backfills from a register)
 *   - Holiday/weekend marking for an employee who worked
 *   - On-leave marking for an employee who didn't apply through the system
 *
 * Body:
 *   {
 *     "employeeId": "emp_...",
 *     "date": "2026-07-03",
 *     "checkIn": "09:00",        // optional (HH:MM, 24h)
 *     "checkOut": "18:00",       // optional
 *     "status": "present",        // present|absent|half_day|on_leave|holiday|weekend
 *     "notes": "Backfilled from register"
 *   }
 *
 * Behavior:
 *   - If no existing record → CREATE with source="manual"
 *   - If existing record with source="manual" → UPDATE (HR can correct)
 *   - If existing record with source="biometric" → UPDATE but preserve biometric
 *     check-in if it's earlier than the manual one (merge logic)
 *   - If existing record with source="web" (employee self check-in) → UPDATE
 *     but preserve web check-in if earlier
 *
 * Authorization: admin / hr_admin / super_admin only
 */
export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = manualAttendanceSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validation.error.issues.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        const { employeeId, date, checkIn, checkOut, status, notes } = validation.data;

        // Verify employee belongs to org
        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: { id: employeeId, organizationId: ctx.organizationId },
            include: {
                shift: {
                    select: {
                        startTime: true,
                        endTime: true,
                        graceMinutes: true,
                        crossesMidnight: true,
                    },
                },
            },
        }));

        if (!employee) {
            return NextResponse.json(
                { error: "Employee not found in your organization" },
                { status: 404 },
            );
        }

        // Normalize the date to start-of-business-day (UTC midnight for BD-local day)
        const attendanceDate = startOfBusinessDay(date);

        // Build check-in/check-out Date objects from HH:MM strings
        let checkInDate: Date | null = null;
        let checkOutDate: Date | null = null;

        if (checkIn) {
            checkInDate = buildBusinessDateTime(attendanceDate, checkIn);
        }
        if (checkOut) {
            checkOutDate = buildBusinessDateTime(attendanceDate, checkOut);
        }

        // Validate: check-out must be after check-in
        if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
            return NextResponse.json(
                { error: "Check-out time must be after check-in time" },
                { status: 400 },
            );
        }

        // Calculate late/early-leave/overtime if shift is configured
        let lateMinutes = 0;
        let earlyLeaveMinutes = 0;
        let overtimeMinutes = 0;

        if (employee.shift && checkInDate) {
            const shiftStart = buildBusinessDateTime(attendanceDate, employee.shift.startTime);
            const graceMs = (employee.shift.graceMinutes || 0) * 60_000;
            const lateMs = checkInDate.getTime() - (shiftStart.getTime() + graceMs);
            lateMinutes = lateMs > 0 ? Math.round(lateMs / 60_000) : 0;

            if (checkOutDate) {
                const shiftEndDate = employee.shift.crossesMidnight
                    ? buildBusinessDateTime(
                          new Date(attendanceDate.getTime() + 86_400_000),
                          employee.shift.endTime,
                      )
                    : buildBusinessDateTime(attendanceDate, employee.shift.endTime);
                const endDiffMs = checkOutDate.getTime() - shiftEndDate.getTime();
                if (endDiffMs < 0) {
                    earlyLeaveMinutes = Math.round(Math.abs(endDiffMs) / 60_000);
                } else {
                    overtimeMinutes = Math.round(endDiffMs / 60_000);
                }
            }
        }

        // Check for existing record (merge logic)
        const existing = await auth.withDB((db) => db.attendance.findUnique({
            where: {
                employeeId_date: { employeeId, date: attendanceDate },
            },
        }));

        let finalCheckIn = checkInDate;
        let finalCheckOut = checkOutDate;

        if (existing) {
            // Preserve earlier check-in from biometric/web sources
            if (existing.checkIn && (!finalCheckIn || existing.checkIn < finalCheckIn)) {
                finalCheckIn = existing.checkIn;
            }
            // Preserve later check-out
            if (existing.checkOut && (!finalCheckOut || existing.checkOut > finalCheckOut)) {
                finalCheckOut = existing.checkOut;
            }
        }

        const auditNote = `[MANUAL] by HR on ${new Date().toISOString().split("T")[0]}.${notes ? ` ${notes}` : ""}`;

        const record = await auth.withDB((db) => db.attendance.upsert({
            where: {
                employeeId_date: { employeeId, date: attendanceDate },
            },
            create: {
                employeeId,
                organizationId: ctx.organizationId,
                date: attendanceDate,
                checkIn: finalCheckIn,
                checkOut: finalCheckOut,
                status,
                source: "manual",
                lateMinutes,
                earlyLeaveMinutes,
                overtimeMinutes,
                notes: auditNote,
            },
            update: {
                checkIn: finalCheckIn,
                checkOut: finalCheckOut || undefined,
                status,
                source: "manual",
                lateMinutes,
                earlyLeaveMinutes,
                overtimeMinutes,
                notes: existing?.notes
                    ? `${existing.notes} | ${auditNote}`
                    : auditNote,
            },
        }));

        await createAuditLog({
            organizationId: ctx.organizationId,
            action: existing ? "update" : "create",
            entityType: "Attendance",
            entityId: record.id,
            oldValues: existing
                ? {
                      status: existing.status,
                      checkIn: existing.checkIn,
                      checkOut: existing.checkOut,
                      source: existing.source,
                  }
                : undefined,
            newValues: {
                employeeId,
                date: attendanceDate.toISOString(),
                status,
                checkIn: finalCheckIn?.toISOString(),
                checkOut: finalCheckOut?.toISOString(),
                source: "manual",
                lateMinutes,
                earlyLeaveMinutes,
                overtimeMinutes,
            },
            userId: ctx.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            attendanceLogger.error({ err }, "Audit log failed for manual attendance");
        });

        return NextResponse.json({
            success: true,
            attendance: record,
            message: existing
                ? "Attendance record updated."
                : "Attendance record created.",
        });
    } catch (error) {
        attendanceLogger.error({ err: error }, "MANUAL_ATTENDANCE_ERROR");
        return NextResponse.json(
            { error: "Failed to save manual attendance" },
            { status: 500 },
        );
    }
}
