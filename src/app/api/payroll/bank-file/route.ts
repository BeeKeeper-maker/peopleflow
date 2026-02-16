import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrHR } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { generateBankFileCSV } from "@/lib/payroll-engine";

/**
 * POST - Generate bank transfer file for bulk salary payment
 */
export async function POST(req: Request) {
    try {
        // ✅ FIXED: Proper auth check — requireAdminOrHR returns AuthContext | NextResponse
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const body = await req.json();
        const { month, year } = body;

        // ✅ Input validation
        if (!month || typeof month !== "number" || month < 1 || month > 12) {
            return NextResponse.json(
                { error: "Valid month is required (1-12)" },
                { status: 400 }
            );
        }

        if (!year || typeof year !== "number" || year < 2020 || year > 2099) {
            return NextResponse.json(
                { error: "Valid year is required (2020-2099)" },
                { status: 400 }
            );
        }

        // ✅ Org-scoped: only fetch salary slips for caller's organization
        const salarySlips = await prisma.salarySlip.findMany({
            where: {
                month,
                year,
                status: { in: ["approved", "paid"] },
                employee: { organizationId: ctx.organizationId },
            },
            include: {
                employee: {
                    include: {
                        user: { select: { name: true } },
                    },
                },
            },
        });

        if (salarySlips.length === 0) {
            return NextResponse.json(
                { error: "No approved salary slips found for this month" },
                { status: 404 }
            );
        }

        const entries = salarySlips.map(slip => ({
            employeeName: slip.employee.user?.name || "Unknown",
            employeeId: slip.employee.employeeCode || slip.employee.id,
            bankAccountNumber: slip.employee.accountNumber || "",
            bankName: slip.employee.bankName || "",
            branchName: slip.employee.bankBranch || "",
            routingNumber: slip.employee.routingNumber || "",
            amount: slip.netSalary,
        }));

        const csvContent = generateBankFileCSV(entries, month, year);

        // Return as downloadable CSV
        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="salary_payment_${year}_${String(month).padStart(2, "0")}.csv"`,
            },
        });
    } catch (error) {
        console.error("Bank file generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate bank file" },
            { status: 500 }
        );
    }
}
