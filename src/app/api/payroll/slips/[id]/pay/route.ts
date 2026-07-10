import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { payrollLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/payroll/slips/[id]/pay — Mark a salary slip as paid
 *
 * Transitions a SalarySlip to status "paid" and records payment metadata.
 * Allowed transitions:
 *   - "approved" → "paid"   (normal flow)
 *   - "draft"    → "paid"   (shortcut for small orgs that skip approval)
 *
 * Body (all optional):
 *   {
 *     "paymentDate":   "2026-07-03T10:00:00Z",  // defaults to now
 *     "paymentMode":   "bank_transfer" | "cash" | "cheque",
 *     "transactionRef": "TXN-12345"
 *   }
 *
 * Authorization: admin / hr_admin / super_admin only.
 *
 * Side effects:
 *   - SalarySlip.status → "paid"
 *   - SalarySlip.paymentDate / paymentMode / transactionRef set
 *   - AuditLog entry created
 */
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return NextResponse.json(
            { error: "Forbidden", code: "ACCESS_DENIED" },
            { status: 403 },
        );
    }

    try {
        const { id } = await params;

        // findFirst + deletedAt: null so soft-deleted slips cannot be paid
        // (SalarySlip has had deletedAt since P6-SOFT-DELETE).
        const slip = await auth.withDB((db) => db.salarySlip.findFirst({
            where: { id, deletedAt: null },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        organizationId: true,
                    },
                },
            },
        }));

        if (!slip || slip.employee.organizationId !== auth.organizationId) {
            return NextResponse.json(
                { error: "Salary slip not found", code: "NOT_FOUND" },
                { status: 404 },
            );
        }

        if (slip.status === "paid") {
            return NextResponse.json(
                { error: "Salary slip is already marked as paid", code: "ALREADY_PAID" },
                { status: 409 },
            );
        }

        // Only "approved" or "draft" can transition to "paid"
        if (slip.status !== "approved" && slip.status !== "draft") {
            return NextResponse.json(
                { error: `Cannot pay a salary slip with status "${slip.status}"`, code: "INVALID_STATUS" },
                { status: 400 },
            );
        }

        const body = await req.json().catch(() => ({}));
        const paymentMode =
            typeof body?.paymentMode === "string" &&
            ["bank_transfer", "cash", "cheque"].includes(body.paymentMode)
                ? body.paymentMode
                : "bank_transfer";
        const transactionRef =
            typeof body?.transactionRef === "string"
                ? body.transactionRef.trim().slice(0, 200)
                : null;
        const paymentDate =
            typeof body?.paymentDate === "string" && !Number.isNaN(Date.parse(body.paymentDate))
                ? new Date(body.paymentDate)
                : new Date();

        const oldStatus = slip.status;
        const updated = await auth.withDB((db) => db.salarySlip.update({
            where: { id },
            data: {
                status: "paid",
                paymentDate,
                paymentMode,
                transactionRef,
            },
        }));

        await createAuditLog({
            organizationId: auth.organizationId,
            action: "update",
            entityType: "SalarySlip",
            entityId: id,
            oldValues: { status: oldStatus },
            newValues: {
                status: "paid",
                paymentMode,
                transactionRef,
                paymentDate: paymentDate.toISOString(),
            },
            userId: auth.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            payrollLogger.error({ err, slipId: id }, "Failed to write audit log for slip payment");
        });

        payrollLogger.info(
            { slipId: id, employeeId: slip.employeeId, paymentMode, payerUserId: auth.userId },
            "Salary slip marked as paid",
        );

        return NextResponse.json({
            success: true,
            slip: updated,
            message: `Salary slip for ${slip.employee.firstName} ${slip.employee.lastName} (${slip.month}/${slip.year}) marked as paid via ${paymentMode}.`,
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "PAY_SLIP_ERROR");
        return NextResponse.json(
            { error: "Internal server error", code: "INTERNAL_ERROR" },
            { status: 500 },
        );
    }
}
