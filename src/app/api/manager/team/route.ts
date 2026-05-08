import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManagerOrAbove, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

export async function GET() {
    const auth = await requireManagerOrAbove();
    if (!isAuthenticated(auth)) return auth;

    try {
        const where: any = {
            organizationId: auth.organizationId,
            deletedAt: null,
            employmentStatus: "active",
        };

        if (auth.role === "manager") {
            if (!auth.employeeId) return NextResponse.json({ data: [], meta: { total: 0 } });
            where.reportingManagerId = auth.employeeId;
        }

        const employees = await prisma.employee.findMany({
            where,
            include: {
                department: { select: { name: true } },
                designation: { select: { name: true } },
                reportingManager: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        });

        return NextResponse.json({
            data: employees,
            meta: { total: employees.length },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_MANAGER_TEAM_ERROR");
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
