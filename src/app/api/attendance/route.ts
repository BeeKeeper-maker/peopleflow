import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, isAuthenticated } from "@/lib/api-auth";

export async function GET(req: Request) {
    // Authenticate - requires employee profile
    const auth = await requireEmployee();
    if (!isAuthenticated(auth)) {
        return auth; // Returns 401 Unauthorized
    }

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "30");

        const attendances = await prisma.attendance.findMany({
            where: {
                employeeId: auth.employeeId,
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
