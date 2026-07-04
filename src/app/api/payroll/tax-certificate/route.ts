import { NextResponse } from "next/server";

import { requireAdminOrHR } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { calculateAnnualTax } from "@/lib/payroll-engine";
import { payrollLogger } from "@/lib/logger";

/**
 * POST - Generate annual tax certificate data for an employee
 */
export async function POST(req: Request) {
    try {
        // ✅ FIXED: Proper auth check — requireAdminOrHR returns AuthContext | NextResponse
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const body = await req.json();
        const { employeeId, year } = body;

        // ✅ Input validation
        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json(
                { error: "Valid employee ID is required" },
                { status: 400 }
            );
        }

        if (!year || typeof year !== "number" || year < 2020 || year > 2099) {
            return NextResponse.json(
                { error: "Valid year is required (2020-2099)" },
                { status: 400 }
            );
        }

        // ✅ Org-scoping: verify employee belongs to same organization
        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: {
                id: employeeId,
                organizationId: ctx.organizationId,
            },
            include: {
                user: { select: { name: true, email: true } },
                department: { select: { name: true } },
            },
        }));

        if (!employee) {
            return NextResponse.json(
                { error: "Employee not found in your organization" },
                { status: 404 }
            );
        }

        // Get all salary slips for the year
        const salarySlips = await auth.withDB((db) => db.salarySlip.findMany({
            where: {
                employeeId,
                year,
                status: { in: ["approved", "paid"] },
            },
            orderBy: { month: "asc" },
        }));

        if (salarySlips.length === 0) {
            return NextResponse.json(
                { error: "No salary slips found for this year" },
                { status: 404 }
            );
        }

        // Calculate totals using reduce once for efficiency
        const totals = salarySlips.reduce(
            (acc, s) => ({
                gross: acc.gross + s.grossSalary,
                basic: acc.basic + s.basicSalary,
                houseRent: acc.houseRent + s.houseRent,
                medical: acc.medical + s.medicalAllowance,
                conveyance: acc.conveyance + s.conveyance,
                overtime: acc.overtime + s.overtime,
                bonus: acc.bonus + s.bonus,
                pf: acc.pf + s.pfEmployee,
                taxPaid: acc.taxPaid + s.incomeTax,
                net: acc.net + s.netSalary,
            }),
            {
                gross: 0, basic: 0, houseRent: 0, medical: 0,
                conveyance: 0, overtime: 0, bonus: 0, pf: 0,
                taxPaid: 0, net: 0,
            }
        );

        // Calculate actual tax liability
        // ✅ Gender-aware tax calculation
        const isWoman = employee.gender === "female";
        const taxableIncome = totals.gross - totals.pf;
        const annualTax = calculateAnnualTax(taxableIncome, isWoman);

        return NextResponse.json({
            employee: {
                name: employee.user?.name,
                email: employee.user?.email,
                department: employee.department?.name,
                employeeCode: employee.employeeCode,
                gender: employee.gender,
            },
            fiscalYear: `${year}-${year + 1}`,
            monthsCovered: salarySlips.length,
            earnings: {
                basic: totals.basic,
                houseRent: totals.houseRent,
                medical: totals.medical,
                conveyance: totals.conveyance,
                overtime: totals.overtime,
                bonus: totals.bonus,
                totalGross: totals.gross,
            },
            deductions: {
                providentFund: totals.pf,
                incomeTaxPaid: totals.taxPaid,
            },
            taxComputation: {
                totalIncome: totals.gross,
                exemptions: totals.pf,
                taxableIncome,
                womanTaxBenefit: isWoman,
                taxLiability: annualTax,
                taxPaid: totals.taxPaid,
                balanceDue: Math.max(0, annualTax - totals.taxPaid),
                refundDue: Math.max(0, totals.taxPaid - annualTax),
            },
            totalNetPaid: totals.net,
            monthlyBreakdown: salarySlips.map(s => ({
                month: s.month,
                gross: s.grossSalary,
                deductions: s.totalDeductions,
                tax: s.incomeTax,
                net: s.netSalary,
            })),
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "Tax certificate error:");
        return NextResponse.json(
            { error: "Failed to generate tax certificate" },
            { status: 500 }
        );
    }
}
