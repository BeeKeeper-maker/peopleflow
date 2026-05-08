import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { startOfDay } from "date-fns";
import { attendanceLogger } from "@/lib/logger";

export async function GET() {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const employee = await prisma.employee.findFirst({
            where: { userId: auth.userId, organizationId: auth.organizationId },
            select: { id: true, shiftId: true },
        });

        if (!employee) {
            // Return empty data instead of error — admin/HR users may not have employee profiles
            return NextResponse.json({ attendance: null, shift: null });
        }

        const today = new Date();

        // Find today's attendance record
        const attendance = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: employee.id,
                    date: startOfDay(today), // Using startOfDay to normalize date part
                }
            }
        });

        // Find assigned shift to calculate working hours/late status for display
        const shift = employee.shiftId
            ? await prisma.shift.findFirst({
                where: { id: employee.shiftId, organizationId: auth.organizationId },
            })
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
