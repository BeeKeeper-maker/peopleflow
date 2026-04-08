import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { getPFAccountSummary, getPFStatement } from "@/lib/pf-ledger-engine";
import { prisma } from "@/lib/prisma";
import { payrollLogger } from "@/lib/logger";

// GET /api/payroll/pf-ledger — Get PF account summary & transactions
// Query: ?employeeId=xxx (admin) or self (employee)
export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        let employeeId = req.nextUrl.searchParams.get("employeeId");

        // If no employeeId specified, get current user's employee
        if (!employeeId) {
            const employee = await prisma.employee.findFirst({
                where: { userId: auth.userId, organizationId: auth.organizationId },
                select: { id: true },
            });
            if (!employee) {
                return NextResponse.json({ data: { summary: null, transactions: [] } });
            }
            employeeId = employee.id;
        } else {
            // If querying another employee, require admin/HR role
            const adminAuth = await requireAdminOrHR();
            if (!isAuthenticated(adminAuth)) return adminAuth;
        }

        const summary = await getPFAccountSummary(employeeId);
        const transactions = await getPFStatement(employeeId, {
            limit: parseInt(req.nextUrl.searchParams.get("limit") || "50"),
        });

        return NextResponse.json({
            data: {
                summary,
                transactions,
            },
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "PF_LEDGER_GET_ERROR");
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch PF data" },
            { status: 500 }
        );
    }
}
