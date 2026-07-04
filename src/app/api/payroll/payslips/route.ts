import { NextResponse } from "next/server";

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
        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: {
                organizationId: auth.organizationId,
                userId: auth.userId,
            },
            select: { id: true },
        }));

        if (!employee) {
            return NextResponse.json({
                data: [],
                total: 0,
                message: "No employee profile found for this user.",
            });
        }

        // Fetch salary slips for this employee
        // IMPORTANT: Only show approved/paid slips to employees.
        // Draft slips are HR-internal (may contain errors, not yet reviewed).
        // Reversed slips are excluded (they're corrections, not final).
        const salarySlips = await auth.withDB((db) => db.salarySlip.findMany({
            where: {
                employeeId: employee.id,
                status: { in: ["approved", "paid"] },
                isReversed: false,
            },
            orderBy: [{ year: "desc" }, { month: "desc" }],
        }));

        return NextResponse.json({
            data: salarySlips,
            total: salarySlips.length,
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "GET_PAYSLIPS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
