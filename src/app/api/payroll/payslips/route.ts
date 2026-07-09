import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { toNumber } from "@/lib/payroll-engine";
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

        // Phase 1 (Float → Decimal): convert Decimal monetary fields to numbers so
        // JSON serialization produces numbers (the ESS payslips page does arithmetic
        // like `latestPayslip.netSalary - previousPayslip.netSalary`).
        const data = salarySlips.map((slip) => ({
            ...slip,
            totalWorkingDays: toNumber(slip.totalWorkingDays),
            presentDays: toNumber(slip.presentDays),
            absentDays: toNumber(slip.absentDays),
            leaveDays: toNumber(slip.leaveDays),
            basicSalary: toNumber(slip.basicSalary),
            houseRent: toNumber(slip.houseRent),
            medicalAllowance: toNumber(slip.medicalAllowance),
            conveyance: toNumber(slip.conveyance),
            specialAllowance: toNumber(slip.specialAllowance),
            overtime: toNumber(slip.overtime),
            bonus: toNumber(slip.bonus),
            festivalBonus: toNumber(slip.festivalBonus),
            arrears: toNumber(slip.arrears),
            otherEarnings: toNumber(slip.otherEarnings),
            grossSalary: toNumber(slip.grossSalary),
            pfEmployee: toNumber(slip.pfEmployee),
            pfEmployer: toNumber(slip.pfEmployer),
            incomeTax: toNumber(slip.incomeTax),
            loanDeduction: toNumber(slip.loanDeduction),
            absentDeduction: toNumber(slip.absentDeduction),
            lateDeduction: toNumber(slip.lateDeduction),
            otherDeductions: toNumber(slip.otherDeductions),
            totalDeductions: toNumber(slip.totalDeductions),
            netSalary: toNumber(slip.netSalary),
        }));

        return NextResponse.json({
            data,
            total: salarySlips.length,
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "GET_PAYSLIPS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
