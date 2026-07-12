import { NextRequest, NextResponse } from "next/server";
import { withTenant, withPlatform } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { processApprovalStep } from "@/lib/approval-engine";
import { emit } from "@/lib/event-bus";
import { apiLogger } from "@/lib/logger";

type RouteParams = {
    params: Promise<{ id: string }>;
};

const updateSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
    categoryId: z.string().optional(),
    expenseDate: z.string().optional(),
    receiptUrl: z.string().optional(),
    receiptName: z.string().optional(),
    status: z.enum(["draft", "submitted", "cancelled"]).optional(),
});

const approvalSchema = z.object({
    action: z.enum(["approve", "reject", "reimburse"]),
    notes: z.string().optional(),
    paymentMethod: z.string().optional(),
    paymentReference: z.string().optional(),
});

function canAccessClaim(user: { role: string; employee?: { id: string } | null }, claim: { employeeId: string; employee?: { reportingManagerId: string | null } | null }) {
    const isHR = ["admin", "hr_admin", "super_admin"].includes(user.role);
    if (isHR) return true;
    if (!user.employee) return false;
    if (claim.employeeId === user.employee.id) return true;
    return user.role === "manager" && claim.employee?.reportingManagerId === user.employee.id;
}

function canApproveClaim(user: { role: string; employee?: { id: string } | null }, claim: { employee?: { reportingManagerId: string | null } | null }) {
    if (["admin", "hr_admin", "super_admin"].includes(user.role)) return true;
    return user.role === "manager" && !!user.employee && claim.employee?.reportingManagerId === user.employee.id;
}

// GET - Get single expense claim
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await withPlatform((db) =>
            db.user.findUnique({
                where: { id: session.user.id },
                include: { employee: true },
            }),
        );

        if (!user?.organizationId) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        const claim = await withTenant(user.organizationId, (db) =>
            db.expenseClaim.findUnique({
                where: { id },
                include: {
                    category: true,
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            photoUrl: true,
                            reportingManagerId: true,
                            department: { select: { name: true } },
                            designation: { select: { name: true } },
                        },
                    },
                    approver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            }),
        );

        if (!claim || claim.organizationId !== user.organizationId || !canAccessClaim(user, claim)) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(claim);
    } catch (error) {
        apiLogger.error({ err: error }, "Error fetching expense claim:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// PATCH - Update expense claim or process approval
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await withPlatform((db) =>
            db.user.findUnique({
                where: { id: session.user.id },
                include: { employee: true },
            }),
        );

        if (!user?.organizationId) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        const claim = await withTenant(user.organizationId, (db) =>
            db.expenseClaim.findUnique({
                where: { id },
                include: { employee: { select: { id: true, reportingManagerId: true } } },
            }),
        );

        if (!claim || claim.organizationId !== user.organizationId || !canAccessClaim(user, claim)) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const body = await request.json();

        // Check if this is an approval action
        if (body.action) {
            const approvalData = approvalSchema.parse(body);
            const isManager = user.role === "manager";
            const isHR = ["admin", "hr_admin", "super_admin"].includes(user.role);

            // Only HR/admin or the direct reporting manager can approve/reject/reimburse
            if (!isHR && (!isManager || !canApproveClaim(user, claim))) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            if (!user.employee) {
                return NextResponse.json({ error: "Employee profile required" }, { status: 400 });
            }

            // ── ✅ Route approve/reject through Stateful Approval Engine ──
            if (approvalData.action === "approve" || approvalData.action === "reject") {
                const approvalRequest = await withTenant(user.organizationId, (db) =>
                    db.approvalRequest.findUnique({
                        where: { entityType_entityId: { entityType: "expense", entityId: id } },
                    }),
                );

                if (approvalRequest && approvalRequest.status === "in_progress") {
                    const result = await processApprovalStep({
                        approvalRequestId: approvalRequest.id,
                        actorId: user.employee.id,
                        action: approvalData.action,
                        notes: approvalData.notes,
                    });

                    if (!result.success) {
                        return NextResponse.json({ error: result.message }, { status: 400 });
                    }

                    // Fetch updated claim
                    const updatedClaim = await withTenant(user.organizationId, (db) =>
                        db.expenseClaim.findUnique({
                            where: { id },
                            include: {
                                category: true,
                                employee: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        user: { select: { id: true, email: true } },
                                    },
                                },
                            },
                        }),
                    );

                    // 🔔 Emit notification for the approved/rejected expense
                    if (updatedClaim?.employee?.user?.id) {
                        const empName = `${updatedClaim.employee.firstName} ${updatedClaim.employee.lastName}`;
                        const eventName = approvalData.action === "approve" ? "expense.approved" : "expense.rejected";
                        emit(eventName, {
                            userId: updatedClaim.employee.user.id,
                            employeeName: empName,
                            employeeEmail: updatedClaim.employee.user.email || undefined,
                            title: updatedClaim.title || "Expense Claim",
                            amount: Number(updatedClaim.amount),
                            ...(approvalData.action === "reject" ? { reason: approvalData.notes } : {}),
                        } as any).catch((err: unknown) => apiLogger.error({ err: err }, "[EVENT_FAIL] expense:"));
                    }

                    return NextResponse.json({
                        ...updatedClaim,
                        approvalMessage: result.message,
                        approvalTrail: result.request,
                    });
                }
            }

            // ── FALLBACK: Direct update (no ApprovalRequest or reimburse action) ──
            let updateData: any = {
                approverNotes: approvalData.notes,
                approverId: user.employee.id,
            };

            switch (approvalData.action) {
                case "approve":
                    if (claim.status !== "submitted") {
                        return NextResponse.json({ error: "Can only approve submitted claims" }, { status: 400 });
                    }
                    updateData.status = "approved";
                    updateData.approvedAt = new Date();
                    break;

                case "reject":
                    if (claim.status !== "submitted") {
                        return NextResponse.json({ error: "Can only reject submitted claims" }, { status: 400 });
                    }
                    updateData.status = "rejected";
                    updateData.rejectedAt = new Date();
                    break;

                case "reimburse":
                    if (claim.status !== "approved") {
                        return NextResponse.json({ error: "Can only reimburse approved claims" }, { status: 400 });
                    }
                    updateData.status = "reimbursed";
                    updateData.reimbursedAt = new Date();
                    updateData.paymentMethod = approvalData.paymentMethod;
                    updateData.paymentReference = approvalData.paymentReference;
                    break;
            }

            const updated = await withTenant(user.organizationId, (db) =>
                db.expenseClaim.update({
                    where: { id },
                    data: updateData,
                    include: {
                        category: true,
                        employee: {
                            select: {
                                firstName: true,
                                lastName: true,
                                user: { select: { id: true, email: true } },
                            },
                        },
                    },
                }),
            );

            // 🔔 Emit notification for fallback status changes
            if (updated.employee?.user?.id) {
                const empName = `${updated.employee.firstName} ${updated.employee.lastName}`;
                if (approvalData.action === "approve") {
                    emit("expense.approved", {
                        userId: updated.employee.user.id,
                        employeeName: empName,
                        employeeEmail: updated.employee.user.email || undefined,
                        title: updated.title || "Expense Claim",
                        amount: Number(updated.amount),
                    }).catch((err) => apiLogger.error({ err: err }, "[EVENT_FAIL] expense.approved:"));
                } else if (approvalData.action === "reject") {
                    emit("expense.rejected", {
                        userId: updated.employee.user.id,
                        employeeName: empName,
                        title: updated.title || "Expense Claim",
                        amount: Number(updated.amount),
                        reason: approvalData.notes,
                    }).catch((err) => apiLogger.error({ err: err }, "[EVENT_FAIL] expense.rejected:"));
                } else if (approvalData.action === "reimburse") {
                    emit("expense.reimbursed", {
                        userId: updated.employee.user.id,
                        employeeName: empName,
                        title: updated.title || "Expense Claim",
                        amount: Number(updated.amount),
                    }).catch((err) => apiLogger.error({ err: err }, "[EVENT_FAIL] expense.reimbursed:"));
                }
            }

            return NextResponse.json(updated);
        }

        // Regular update - only owner can update draft/rejected claims
        if (claim.employeeId !== user.employee?.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!["draft", "rejected"].includes(claim.status)) {
            return NextResponse.json({ error: "Cannot update claim in current status" }, { status: 400 });
        }

        const validatedData = updateSchema.parse(body);

        const updated = await withTenant(user.organizationId, (db) =>
            db.expenseClaim.update({
                where: { id },
                data: {
                    ...validatedData,
                    ...(validatedData.expenseDate && { expenseDate: new Date(validatedData.expenseDate) }),
                    ...(validatedData.status === "submitted" && { submittedAt: new Date() }),
                },
                include: {
                    category: true,
                },
            }),
        );

        return NextResponse.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        apiLogger.error({ err: error }, "Error updating expense claim:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE - Delete expense claim (only draft/rejected)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await withPlatform((db) =>
            db.user.findUnique({
                where: { id: session.user.id },
                include: { employee: true },
            }),
        );

        if (!user?.organizationId || !user.employee) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        const claim = await withTenant(user.organizationId, (db) =>
            db.expenseClaim.findUnique({
                where: { id },
            }),
        );

        if (!claim || claim.organizationId !== user.organizationId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Only owner can delete draft claims
        if (claim.employeeId !== user.employee.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!["draft", "rejected"].includes(claim.status)) {
            return NextResponse.json({ error: "Cannot delete claim in current status" }, { status: 400 });
        }

        await withTenant(user.organizationId, (db) =>
            db.expenseClaim.delete({ where: { id } }),
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "Error deleting expense claim:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
