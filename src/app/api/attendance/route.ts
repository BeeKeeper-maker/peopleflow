import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) {
        return auth;
    }

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "30");
        const requestedEmployeeId = searchParams.get("employeeId");

        // Determine target employee
        let targetEmployeeId: string;

        if (requestedEmployeeId && ["admin", "hr_admin", "manager"].includes(auth.role)) {
            // Admin/HR/Manager can view any employee's attendance in their org
            const employee = await prisma.employee.findFirst({
                where: { id: requestedEmployeeId, organizationId: auth.organizationId },
                select: { id: true },
            });
            if (!employee) {
                return new NextResponse("Employee not found", { status: 404 });
            }
            targetEmployeeId = employee.id;
        } else if (auth.employeeId) {
            // Regular employee: only own attendance
            targetEmployeeId = auth.employeeId;
        } else {
            // Admin/HR users may not have employee profiles — return empty list
            return NextResponse.json([]);
        }

        const attendances = await prisma.attendance.findMany({
            where: {
                employeeId: targetEmployeeId,
            },
            orderBy: {
                date: 'desc',
            },
            take: limit,
        });

        return NextResponse.json(attendances);

    } catch (error) {
        console.error("GET_ATTENDANCE_HISTORY_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
