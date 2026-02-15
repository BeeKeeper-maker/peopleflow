import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { employee: true },
        });

        if (!user?.employee) {
            // Return empty data instead of error — admin/HR users may not have employee profiles
            return NextResponse.json({ attendance: null, shift: null });
        }

        const today = new Date();

        // Find today's attendance record
        const attendance = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: user.employee.id,
                    date: startOfDay(today), // Using startOfDay to normalize date part
                }
            }
        });

        // Find assigned shift to calculate working hours/late status for display
        const shift = user.employee.shiftId
            ? await prisma.shift.findUnique({ where: { id: user.employee.shiftId } })
            : null;

        return NextResponse.json({
            attendance,
            shift
        });

    } catch (error) {
        console.error("GET_ATTENDANCE_STATUS_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
