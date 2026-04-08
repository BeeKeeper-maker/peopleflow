import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { payrollLogger } from "@/lib/logger";

// GET /api/payroll/payslips - Get current employee's salary slips
export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) {
        return auth;
    }

    try {
        // Find the employee linked to the current user
        const employee = await prisma.employee.findFirst({
            where: {
                organizationId: auth.organizationId,
                userId: auth.userId,
            },
            select: { id: true },
        });

        if (!employee) {
            return NextResponse.json({
                data: [],
                total: 0,
                message: "No employee profile found for this user.",
            });
        }

        // Fetch salary slips for this employee
        const salarySlips = await prisma.salarySlip.findMany({
            where: {
                employeeId: employee.id,
            },
            orderBy: [{ year: "desc" }, { month: "desc" }],
        });

        return NextResponse.json({
            data: salarySlips,
            total: salarySlips.length,
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "GET_PAYSLIPS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
