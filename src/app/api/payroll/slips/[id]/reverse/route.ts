import { NextResponse } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { payrollLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/payroll/slips/[id]/reverse — Reverse a paid salary slip
 *
 * Reversal marks the slip as "reversed" (isReversed=true) without deleting it.
 * This preserves the audit trail. The slip's status is set to "reversed"
 * and it no longer blocks re-processing.
 *
 * After reversal, HR can re-process payroll for that employee/month to
 * generate a corrected slip.
 *
 * Body:
 *   { "reason": "..." }  // required — why is this slip being reversed?
 *
 * Authorization: admin / hr_admin / super_admin only
 *
 * Common use cases:
 *   - Wrong salary structure was used → reverse + re-process with correct structure
 *   - Attendance data was incomplete → reverse + re-process after attendance correction
 *   - Bonus amount was wrong → reverse + re-process with correct bonus
 */
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : null;

        if (!reason) {
            return NextResponse.json(
                { error: "A reason is required to reverse a salary slip", code: "REASON_REQUIRED" },
                { status: 400 },
            );
        }

        // findFirst + deletedAt: null so soft-deleted slips cannot be reversed
        // (SalarySlip has had deletedAt since P6-SOFT-DELETE).
        const slip = await auth.withDB((db) => db.salarySlip.findFirst({
            where: { id, deletedAt: null },
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, organizationId: true },
                },
            },
        }));

        if (!slip || slip.employee.organizationId !== ctx.organizationId) {
            return NextResponse.json(
                { error: "Salary slip not found", code: "NOT_FOUND" },
                { status: 404 },
            );
        }

        if (slip.isReversed) {
            return NextResponse.json(
                { error: "Slip is already reversed", code: "ALREADY_REVERSED" },
                { status: 409 },
            );
        }

        // Locked slips must be unlocked first (extra safety)
        if (slip.isLocked) {
            return NextResponse.json(
                {
                    error: "Slip is locked. Unlock it first before reversing.",
                    code: "LOCKED",
                },
                { status: 409 },
            );
        }

        const now = new Date();
        const updated = await auth.withDB((db) => db.salarySlip.update({
            where: { id },
            data: {
                isReversed: true,
                reversedAt: now,
                reversedById: ctx.userId,
                reversedReason: reason,
                status: "reversed",
            },
        }));

        await createAuditLog({
            organizationId: ctx.organizationId,
            action: "update",
            entityType: "SalarySlip",
            entityId: id,
            oldValues: {
                status: slip.status,
                isReversed: false,
                netSalary: slip.netSalary,
            },
            newValues: {
                status: "reversed",
                isReversed: true,
                reason,
                reversedBy: ctx.userId,
            },
            userId: ctx.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            payrollLogger.error({ err, slipId: id }, "Audit log failed for slip reversal");
        });

        payrollLogger.warn(
            { slipId: id, employeeId: slip.employeeId, reason, reverserUserId: ctx.userId },
            "Salary slip REVERSED — can now be re-processed",
        );

        return NextResponse.json({
            success: true,
            slip: updated,
            message: `Salary slip for ${slip.employee.firstName} ${slip.employee.lastName} (${slip.month}/${slip.year}) reversed. You can now re-process payroll for this period to generate a corrected slip.`,
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "REVERSE_SLIP_ERROR");
        return NextResponse.json(
            { error: "Internal server error", code: "INTERNAL_ERROR" },
            { status: 500 },
        );
    }
}
