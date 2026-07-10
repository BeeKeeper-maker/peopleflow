import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { payrollLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/payroll/slips/[id]/approve — Approve a salary slip
 *
 * Transitions a SalarySlip from status "draft" → "approved".
 * Only slips in "draft" status can be approved.
 *
 * Authorization: admin / hr_admin / super_admin only.
 *
 * Side effects:
 *   - SalarySlip.status → "approved"
 *   - SalarySlip.updatedAt → now
 *   - AuditLog entry created
 *
 * After approval, the slip becomes eligible for:
 *   - Bank file generation (filter: status in ["approved","paid"])
 *   - Tax certificate generation
 *   - Payment (POST /api/payroll/slips/[id]/pay → status "paid")
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

        // Load the slip and verify it belongs to the authed org.
        // findFirst + deletedAt: null so soft-deleted slips cannot be approved
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

        if (slip.status === "approved") {
            return NextResponse.json(
                { error: "Salary slip is already approved", code: "ALREADY_APPROVED" },
                { status: 409 },
            );
        }

        if (slip.status === "paid") {
            return NextResponse.json(
                { error: "Cannot approve a salary slip that has already been paid", code: "ALREADY_PAID" },
                { status: 409 },
            );
        }

        if (slip.status !== "draft") {
            return NextResponse.json(
                { error: `Cannot approve a salary slip with status "${slip.status}"`, code: "INVALID_STATUS" },
                { status: 400 },
            );
        }

        const body = await req.json().catch(() => ({}));
        const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

        const updated = await auth.withDB((db) => db.salarySlip.update({
            where: { id },
            data: {
                status: "approved",
            },
        }));

        await createAuditLog({
            organizationId: auth.organizationId,
            action: "approve",
            entityType: "SalarySlip",
            entityId: id,
            oldValues: { status: "draft" },
            newValues: { status: "approved", note },
            userId: auth.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            payrollLogger.error({ err, slipId: id }, "Failed to write audit log for slip approval");
        });

        payrollLogger.info(
            { slipId: id, employeeId: slip.employeeId, approverUserId: auth.userId },
            "Salary slip approved",
        );

        return NextResponse.json({
            success: true,
            slip: updated,
            message: `Salary slip for ${slip.employee.firstName} ${slip.employee.lastName} (${slip.month}/${slip.year}) approved.`,
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "APPROVE_SLIP_ERROR");
        return NextResponse.json(
            { error: "Internal server error", code: "INTERNAL_ERROR" },
            { status: 500 },
        );
    }
}
