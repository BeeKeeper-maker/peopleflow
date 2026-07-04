import { NextResponse } from "next/server";

import { requireAdminOrHR } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { generateBankFileCSV } from "@/lib/payroll-engine";
import { payrollLogger } from "@/lib/logger";

/**
 * GET /api/payroll/bank-file?month=7&year=2026 — Generate bank transfer CSV
 * POST /api/payroll/bank-file — Same, with JSON body { month, year }
 *
 * Generates a CSV file for bulk salary disbursement via bank transfer.
 * Only includes approved/paid salary slips for the specified month/year.
 *
 * CSV format columns:
 *   Employee Name, Employee Code, Bank Account, Bank Name, Branch, Routing, Amount (BDT)
 */
export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const { searchParams } = new URL(req.url);
        const month = parseInt(searchParams.get("month") || "0", 10);
        const year = parseInt(searchParams.get("year") || "0", 10);

        if (!month || month < 1 || month > 12) {
            return NextResponse.json({ error: "Valid month (1-12) is required" }, { status: 400 });
        }
        if (!year || year < 2020 || year > 2099) {
            return NextResponse.json({ error: "Valid year (2020-2099) is required" }, { status: 400 });
        }

        return await generateBankFile(ctx, month, year);
    } catch (error) {
        payrollLogger.error({ err: error }, "Bank file GET error:");
        return NextResponse.json({ error: "Failed to generate bank file" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const body = await req.json().catch(() => ({}));
        const { month, year } = body;

        if (!month || typeof month !== "number" || month < 1 || month > 12) {
            return NextResponse.json({ error: "Valid month (1-12) is required" }, { status: 400 });
        }
        if (!year || typeof year !== "number" || year < 2020 || year > 2099) {
            return NextResponse.json({ error: "Valid year (2020-2099) is required" }, { status: 400 });
        }

        return await generateBankFile(ctx, month, year);
    } catch (error) {
        payrollLogger.error({ err: error }, "Bank file POST error:");
        return NextResponse.json({ error: "Failed to generate bank file" }, { status: 500 });
    }
}

async function generateBankFile(ctx: AuthContext, month: number, year: number) {
    const salarySlips = await ctx.withDB((db) => db.salarySlip.findMany({
        where: {
            month,
            year,
            status: { in: ["approved", "paid"] },
            employee: { organizationId: ctx.organizationId },
        },
        include: {
            employee: {
                include: { user: { select: { name: true } } },
            },
        },
    }));

    if (salarySlips.length === 0) {
        return NextResponse.json(
            { error: "No approved salary slips found for this month" },
            { status: 404 },
        );
    }

    const entries = salarySlips.map(slip => ({
        employeeName: slip.employee.user?.name || `${slip.employee.firstName} ${slip.employee.lastName}`,
        employeeId: slip.employee.employeeCode || slip.employee.id,
        bankAccountNumber: slip.employee.accountNumber || "",
        bankName: slip.employee.bankName || "",
        branchName: slip.employee.bankBranch || "",
        routingNumber: slip.employee.routingNumber || "",
        amount: slip.netSalary,
    }));

    const csvContent = generateBankFileCSV(entries, month, year);

    return new NextResponse(csvContent, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="salary_payment_${year}_${String(month).padStart(2, "0")}.csv"`,
        },
    });
}

