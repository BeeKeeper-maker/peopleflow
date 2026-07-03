import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { disburseSalary, batchDisburseSalary, type DisbursementChannel } from "@/lib/disbursement-engine";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

/**
 * GET /api/payroll/disburse?month=7&year=2026
 * List disbursements for a payroll period.
 */
export async function GET(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { searchParams } = new URL(req.url);
        const month = searchParams.get("month");
        const year = searchParams.get("year");

        const where: Record<string, unknown> = { organizationId: ctx.organizationId };
        if (month && year) {
            where.salarySlip = { month: Number(month), year: Number(year) };
        }

        const disbursements = await prisma.salaryDisbursement.findMany({
            where,
            include: {
                employee: {
                    select: { firstName: true, lastName: true, employeeCode: true },
                },
                salarySlip: {
                    select: { month: true, year: true },
                },
            },
            orderBy: { initiatedAt: "desc" },
        });

        return NextResponse.json({ data: disbursements, total: disbursements.length });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_DISBURSEMENTS_ERROR");
        return NextResponse.json({ error: "Failed to fetch disbursements" }, { status: 500 });
    }
}

const disburseSchema = z.object({
    slipIds: z.array(z.string()).min(1, "At least one slip ID is required"),
    channel: z.enum(["bank_transfer", "bkash", "nagad"]),
});

/**
 * POST /api/payroll/disburse — Disburse salary via bKash/Nagad/Bank
 *
 * Body:
 *   { "slipIds": ["slip_1", "slip_2"], "channel": "bkash" }
 *
 * For single slip: pass one ID in the array.
 * For batch: pass multiple IDs.
 *
 * Returns a summary of success/failure per slip.
 */
export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = disburseSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.issues },
                { status: 400 },
            );
        }

        const { slipIds, channel } = validation.data;

        // Single disbursement — direct call
        if (slipIds.length === 1) {
            const result = await disburseSalary({
                salarySlipId: slipIds[0],
                channel: channel as DisbursementChannel,
                organizationId: ctx.organizationId,
                actorUserId: ctx.userId,
            });

            return NextResponse.json({
                success: result.success,
                reference: result.reference,
                error: result.errorMessage,
                message: result.success
                    ? "Salary disbursed successfully."
                    : `Disbursement failed: ${result.errorMessage}`,
            });
        }

        // Batch disbursement
        const result = await batchDisburseSalary({
            slipIds,
            channel: channel as DisbursementChannel,
            organizationId: ctx.organizationId,
            actorUserId: ctx.userId,
        });

        return NextResponse.json({
            success: result.failed === 0,
            summary: {
                total: result.total,
                success: result.success,
                failed: result.failed,
            },
            results: result.results,
            message: `${result.success}/${result.total} disbursements successful.`,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "DISBURSE_SALARY_ERROR");
        return NextResponse.json({ error: "Failed to process disbursement" }, { status: 500 });
    }
}
