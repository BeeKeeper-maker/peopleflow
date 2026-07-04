import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { leaveLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * PATCH /api/leaves/encashment/requests/[id] — Approve or reject an encashment request
 *
 * Body:
 *   { "action": "approve" | "reject", "rejectionReason": "..." }
 *
 * On approve:
 *   - status → "approved"
 *   - LeaveAllocation.usedDays incremented by encashableDays
 *   - approvedAt / approvedById set
 *   - The encashment amount will be picked up by the next payroll run
 *     for this employee (payroll engine reads pending encashment requests)
 *
 * On reject:
 *   - status → "rejected"
 *   - rejectionReason set
 *   - Leave balance unchanged
 *
 * Authorization: admin / hr_admin / super_admin only
 */
export async function PATCH(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const body = await req.json();
        const action = body?.action === "approve" ? "approve" : body?.action === "reject" ? "reject" : null;
        const rejectionReason =
            typeof body?.rejectionReason === "string" ? body.rejectionReason.slice(0, 500) : null;

        if (!action) {
            return NextResponse.json(
                { error: "action must be 'approve' or 'reject'" },
                { status: 400 },
            );
        }

        if (action === "reject" && !rejectionReason) {
            return NextResponse.json(
                { error: "rejectionReason is required when rejecting" },
                { status: 400 },
            );
        }

        // Load the request, verifying org scope
        const request = await ctx.withDB((db) =>
            db.leaveEncashmentRequest.findFirst({
                where: { id, organizationId: ctx.organizationId },
                include: {
                    employee: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    leaveType: { select: { id: true, name: true } },
                },
            }),
        );

        if (!request) {
            return NextResponse.json(
                { error: "Encashment request not found" },
                { status: 404 },
            );
        }

        if (request.status !== "pending") {
            return NextResponse.json(
                {
                    error: `Request is already ${request.status}. No further action possible.`,
                    code: "ALREADY_PROCESSED",
                },
                { status: 409 },
            );
        }

        const now = new Date();

        if (action === "approve") {
            // Operations inside withDB already run in a single transaction
            // (withTenant opens $transaction), so sequential calls are atomic.
            await ctx.withDB(async (db) => {
                await db.leaveEncashmentRequest.update({
                    where: { id },
                    data: {
                        status: "approved",
                        approvedAt: now,
                        approvedById: ctx.employeeId || null,
                    },
                });

                if (request.allocationId) {
                    await db.leaveAllocation.update({
                        where: { id: request.allocationId },
                        data: {
                            usedDays: { increment: request.encashableDays },
                        },
                    });
                }
            });

            await createAuditLog({
                organizationId: ctx.organizationId,
                action: "approve",
                entityType: "LeaveEncashmentRequest",
                entityId: id,
                oldValues: { status: "pending" },
                newValues: {
                    status: "approved",
                    encashableDays: request.encashableDays,
                    encashmentAmount: request.encashmentAmount,
                    approvedBy: ctx.employeeId,
                },
                userId: ctx.userId,
                ipAddress: req.headers.get("x-forwarded-for") || undefined,
                userAgent: req.headers.get("user-agent") || undefined,
            }).catch((err) => {
                leaveLogger.error({ err }, "Audit log failed for encashment approval");
            });

            return NextResponse.json({
                success: true,
                message: `Encashment request approved for ${request.employee.firstName} ${request.employee.lastName}. BDT ${request.encashmentAmount} will be included in the next payroll run. Leave balance reduced by ${request.encashableDays} day(s).`,
            });
        } else {
            // Reject
            await ctx.withDB((db) =>
                db.leaveEncashmentRequest.update({
                    where: { id },
                    data: {
                        status: "rejected",
                        rejectionReason,
                        approvedById: ctx.employeeId || null,
                    },
                }),
            );

            await createAuditLog({
                organizationId: ctx.organizationId,
                action: "reject",
                entityType: "LeaveEncashmentRequest",
                entityId: id,
                oldValues: { status: "pending" },
                newValues: { status: "rejected", rejectionReason },
                userId: ctx.userId,
                ipAddress: req.headers.get("x-forwarded-for") || undefined,
                userAgent: req.headers.get("user-agent") || undefined,
            }).catch((err) => {
                leaveLogger.error({ err }, "Audit log failed for encashment rejection");
            });

            return NextResponse.json({
                success: true,
                message: `Encashment request rejected. Leave balance unchanged.`,
            });
        }
    } catch (error) {
        leaveLogger.error({ err: error }, "PATCH_ENCASHMENT_REQUEST_ERROR");
        return NextResponse.json(
            { error: "Failed to process encashment request" },
            { status: 500 },
        );
    }
}
