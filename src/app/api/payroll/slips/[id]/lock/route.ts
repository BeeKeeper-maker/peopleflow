import { NextResponse } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { payrollLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/payroll/slips/[id]/lock — Lock a salary slip
 * POST /api/payroll/slips/[id]/lock?action=unlock — Unlock a locked slip
 *
 * Locking prevents the slip from being re-processed or modified.
 * Typically applied automatically when a slip is paid, but HR can also
 * lock manually (e.g., after final review).
 *
 * Unlocking requires a reason and is always audit-logged. This is the
 * only way to re-process a locked slip.
 *
 * Body:
 *   { "reason": "..." }  // required for both lock and unlock
 *
 * Authorization: admin / hr_admin / super_admin only
 */
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const url = new URL(req.url);
        const action = url.searchParams.get("action") === "unlock" ? "unlock" : "lock";
        const body = await req.json().catch(() => ({}));
        const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : null;

        if (!reason) {
            return NextResponse.json(
                { error: `A reason is required to ${action} a salary slip`, code: "REASON_REQUIRED" },
                { status: 400 },
            );
        }

        const slip = await auth.withDB((db) => db.salarySlip.findUnique({
            where: { id },
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

        const now = new Date();

        if (action === "lock") {
            if (slip.isLocked) {
                return NextResponse.json(
                    { error: "Slip is already locked", code: "ALREADY_LOCKED" },
                    { status: 409 },
                );
            }

            const updated = await auth.withDB((db) => db.salarySlip.update({
                where: { id },
                data: {
                    isLocked: true,
                    lockedAt: now,
                    lockedById: ctx.userId,
                    lockedReason: reason,
                },
            }));

            await createAuditLog({
                organizationId: ctx.organizationId,
                action: "update",
                entityType: "SalarySlip",
                entityId: id,
                oldValues: { isLocked: false },
                newValues: { isLocked: true, reason, lockedBy: ctx.userId },
                userId: ctx.userId,
                ipAddress: req.headers.get("x-forwarded-for") || undefined,
                userAgent: req.headers.get("user-agent") || undefined,
            }).catch((err) => {
                payrollLogger.error({ err, slipId: id }, "Audit log failed for slip lock");
            });

            return NextResponse.json({
                success: true,
                slip: updated,
                message: `Salary slip for ${slip.employee.firstName} ${slip.employee.lastName} (${slip.month}/${slip.year}) locked. It can no longer be re-processed or modified.`,
            });
        } else {
            // unlock
            if (!slip.isLocked) {
                return NextResponse.json(
                    { error: "Slip is not locked", code: "NOT_LOCKED" },
                    { status: 409 },
                );
            }

            const updated = await auth.withDB((db) => db.salarySlip.update({
                where: { id },
                data: {
                    isLocked: false,
                    lockedAt: null,
                    lockedById: null,
                    lockedReason: null,
                },
            }));

            await createAuditLog({
                organizationId: ctx.organizationId,
                action: "update",
                entityType: "SalarySlip",
                entityId: id,
                oldValues: { isLocked: true, lockedReason: slip.lockedReason },
                newValues: { isLocked: false, unlockReason: reason, unlockedBy: ctx.userId },
                userId: ctx.userId,
                ipAddress: req.headers.get("x-forwarded-for") || undefined,
                userAgent: req.headers.get("user-agent") || undefined,
            }).catch((err) => {
                payrollLogger.error({ err, slipId: id }, "Audit log failed for slip unlock");
            });

            payrollLogger.warn(
                { slipId: id, unlockerUserId: ctx.userId, reason },
                "Salary slip UNLOCKED — slip can now be re-processed",
            );

            return NextResponse.json({
                success: true,
                slip: updated,
                message: `Salary slip for ${slip.employee.firstName} ${slip.employee.lastName} (${slip.month}/${slip.year}) unlocked. It can now be re-processed.`,
            });
        }
    } catch (error) {
        payrollLogger.error({ err: error }, "LOCK_SLIP_ERROR");
        return NextResponse.json(
            { error: "Internal server error", code: "INTERNAL_ERROR" },
            { status: 500 },
        );
    }
}
