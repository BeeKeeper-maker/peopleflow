import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { attendanceLogger } from "@/lib/logger";
import { startOfBusinessDay } from "@/lib/biometric/attendance-ingest";

export async function GET() {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: { userId: auth.userId, organizationId: auth.organizationId },
            select: { id: true, shiftId: true },
        }));

        if (!employee) {
            // Return empty data instead of error — admin/HR users may not have employee profiles
            return NextResponse.json({ attendance: null, shift: null });
        }

        const today = new Date();
        const businessDay = startOfBusinessDay(today);

        // Find today's attendance record
        const attendance = await auth.withDB((db) => db.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: employee.id,
                    date: businessDay,
                }
            }
        }));

        // Find assigned shift to calculate working hours/late status for display
        const shiftId: string | null = employee.shiftId ?? null;
        const shift = shiftId
            ? await auth.withDB((db) => db.shift.findFirst({
                where: { id: shiftId, organizationId: auth.organizationId },
            }))
            : null;

        return NextResponse.json({
            attendance,
            shift
        });

    } catch (error) {
        attendanceLogger.error({ err: error }, "GET_ATTENDANCE_STATUS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
