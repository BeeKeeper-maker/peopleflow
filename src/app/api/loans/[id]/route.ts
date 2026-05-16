import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { resolveApprovalActorEmployee } from "@/lib/approval-actor";
import { processApprovalStep } from "@/lib/approval-engine";
import { emit } from "@/lib/event-bus";
import { apiLogger } from "@/lib/logger";

// PUT /api/loans/[id] — Update loan status (routes through stateful approval engine)
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr/manager can update loan status
    if (!["super_admin", "admin", "hr_admin", "manager"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { id } = await params;
        const json = await req.json();
        const isHR = ["super_admin", "admin", "hr_admin"].includes(auth.role);
        const isManager = auth.role === "manager";

        const existing = await prisma.loan.findFirst({
            where: {
                id,
                employee: {
                    organizationId: auth.organizationId,
                    ...(!isHR && isManager ? { reportingManagerId: auth.employeeId } : {}),
                },
            },
            include: { employee: { select: { organizationId: true, reportingManagerId: true } } },
        });

        if (!existing || existing.employee.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Loan not found" }, { status: 404 });
        }

        // ── ✅ Route approve/reject through Stateful Approval Engine ──
        if (json.status === "approved" || json.status === "rejected") {
            const approvalRequest = await prisma.approvalRequest.findUnique({
                where: { entityType_entityId: { entityType: "loan", entityId: id } },
            });

            if (approvalRequest && approvalRequest.status === "in_progress") {
                const actorEmployee = await resolveApprovalActorEmployee(auth);

                if (!actorEmployee) {
                    return new NextResponse("Approver employee profile not found. Please link this manager account to an employee profile before approval.", { status: 400 });
                }

                const result = await processApprovalStep({
                    approvalRequestId: approvalRequest.id,
                    actorId: actorEmployee.id,
                    action: json.status === "approved" ? "approve" : "reject",
                    notes: json.notes || json.reason,
                });

                if (!result.success) {
                    return NextResponse.json({ error: result.message }, { status: 400 });
                }

                // Fetch updated loan
                const updatedLoan = await prisma.loan.findUnique({
                    where: { id },
                    include: {
                        employee: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                employeeCode: true,
                                user: { select: { id: true } },
                            },
                        },
                    },
                });

                // 🔔 Emit notification for loan approval/rejection
                if (updatedLoan?.employee?.user?.id) {
                    const empName = `${updatedLoan.employee.firstName} ${updatedLoan.employee.lastName}`;
                    const eventName = json.status === "approved" ? "loan.approved" : "loan.rejected";
                    emit(eventName, {
                        userId: updatedLoan.employee.user.id,
                        employeeName: empName,
                        amount: Number(updatedLoan.amount),
                        loanType: (updatedLoan as any).loanType || "Loan",
                        ...(json.status === "rejected" ? { reason: json.notes || json.reason } : {}),
                    } as any).catch((err: unknown) => apiLogger.error({ err: err }, "[EVENT_FAIL] loan:"));
                }

                return NextResponse.json({
                    ...updatedLoan,
                    approvalMessage: result.message,
                    approvalTrail: result.request,
                });
            }
        }

        // ── FALLBACK: Direct update (for statuses the approval engine doesn't handle) ──
        const data: Record<string, unknown> = {};

        if (json.status) {
            data.status = json.status;
            if (json.status === "approved") {
                data.approvedAt = new Date();
                data.approverId = auth.employeeId || null;
            }
            if (json.status === "disbursed") {
                data.disbursedAt = new Date();
                data.disbursedAmount = existing.amount;
            }
        }

        const loan = await prisma.loan.update({
            where: { id },
            data,
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, employeeCode: true },
                },
            },
        });

        return NextResponse.json(loan);
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_LOAN_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// DELETE /api/loans/[id] — Delete a loan
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr can delete loans
    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { id } = await params;

        const existing = await prisma.loan.findFirst({
            where: { id },
            include: { employee: { select: { organizationId: true } } },
        });

        if (!existing || existing.employee.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Loan not found" }, { status: 404 });
        }

        await prisma.loan.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "DELETE_LOAN_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
