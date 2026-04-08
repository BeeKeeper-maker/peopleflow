import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireManagerOrAbove, isAuthenticated } from "@/lib/api-auth";
import { format, eachDayOfInterval } from "date-fns";
import {
    createLeaveNotification,
    getWeekendDays,
    fetchHolidays,
} from "@/lib/leave-utils";
import { processApprovalStep, cancelApprovalRequest } from "@/lib/approval-engine";
import { leaveLogger } from "@/lib/logger";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const { id } = await params;

        // Query with org-level check to prevent IDOR
        const application = await prisma.leaveApplication.findFirst({
            where: {
                id,
                employee: { organizationId: auth.organizationId },
            },
            include: {
                leaveType: true,
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        designation: { select: { name: true } },
                    }
                }
            }
        });

        if (!application) {
            return new NextResponse("Leave application not found", { status: 404 });
        }

        return NextResponse.json(application);
    } catch (error) {
        leaveLogger.error({ err: error }, "GET_LEAVE_APPLICATION_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Only admin, hr_admin, or manager can approve/reject
        const auth = await requireManagerOrAbove();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const { id } = await params;
        const json = await req.json();
        const { status, managerComment } = json;

        if (!["approved", "rejected", "cancelled"].includes(status)) {
            return new NextResponse("Invalid status", { status: 400 });
        }

        // ── ✅ Route through Stateful Approval Engine ──
        // Check if a stateful ApprovalRequest exists for this leave
        const approvalRequest = await prisma.approvalRequest.findUnique({
            where: { entityType_entityId: { entityType: "leave", entityId: id } },
        });

        if (approvalRequest && approvalRequest.status === "in_progress") {
            // Get acting employee ID
            const actorEmployee = await prisma.employee.findFirst({
                where: { userId: auth.userId, organizationId: auth.organizationId },
                select: { id: true },
            });

            if (!actorEmployee) {
                return new NextResponse("Actor employee profile not found", { status: 400 });
            }

            if (status === "cancelled") {
                // Find the requester to cancel
                const cancelResult = await cancelApprovalRequest(
                    approvalRequest.id,
                    approvalRequest.requesterId,
                    managerComment || "Cancelled by manager/HR"
                );

                if (!cancelResult.success) {
                    return new NextResponse(cancelResult.message, { status: 400 });
                }

                // Handle balance revert for cancellation
                await handleCancellation(id, auth.organizationId);

                return NextResponse.json({
                    status: "cancelled",
                    message: cancelResult.message,
                    approvalTrail: cancelResult.request,
                });
            }

            // Approve or Reject via stateful engine
            const result = await processApprovalStep({
                approvalRequestId: approvalRequest.id,
                actorId: actorEmployee.id,
                action: status === "approved" ? "approve" : "reject",
                notes: managerComment,
            });

            if (!result.success) {
                return new NextResponse(result.message, { status: 400 });
            }

            // If FULLY approved (engine auto-updated leave status), handle balance deduction + attendance
            if (result.request?.status === "approved") {
                await handleApproval(id, auth.organizationId);
            }

            // Notify the applicant
            await notifyApplicant(id, status, managerComment);

            return NextResponse.json({
                status: result.request?.status || status,
                message: result.message,
                approvalTrail: result.request,
            });
        }

        // ── FALLBACK: Direct update (no approval request exists — legacy behavior) ──
        const result = await prisma.$transaction(async (tx) => {
            const application = await tx.leaveApplication.findFirst({
                where: {
                    id,
                    employee: { organizationId: auth.organizationId },
                },
                include: {
                    leaveType: true,
                    employee: {
                        include: {
                            user: { select: { id: true } },
                            organization: { select: { settings: true } },
                        },
                    },
                },
            });

            if (!application) {
                throw new Error("Application not found");
            }

            // Prevent invalid status transitions
            if (application.status !== "pending" && application.status !== "approved") {
                throw new Error(`Cannot change status from '${application.status}'`);
            }

            if (status === "approved" && application.status !== "pending") {
                throw new Error("Can only approve pending applications");
            }
            if (status === "rejected" && application.status !== "pending") {
                throw new Error("Can only reject pending applications");
            }
            if (status === "cancelled" && application.status !== "approved") {
                throw new Error("Can only cancel approved applications");
            }

            const updateData: Record<string, unknown> = {
                status,
                rejectionReason: status === "rejected" ? (managerComment || null) : null,
            };

            if (status === "approved") {
                updateData.approvedAt = new Date();
                updateData.approverId = application.employee.user?.id || null;
            }

            const updatedApp = await tx.leaveApplication.update({
                where: { id },
                data: updateData,
            });

            const currentYear = new Date().getFullYear();

            // ── If Approved → Deduct Balance + Create Attendance Records ──
            if (status === "approved" && application.status === "pending") {
                const allocation = await tx.leaveAllocation.findUnique({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId: application.employeeId,
                            leaveTypeId: application.leaveTypeId,
                            year: currentYear,
                        },
                    },
                });

                if (allocation) {
                    await tx.leaveAllocation.update({
                        where: { id: allocation.id },
                        data: { usedDays: { increment: application.totalDays } }
                    });
                } else {
                    await tx.leaveAllocation.create({
                        data: {
                            employeeId: application.employeeId,
                            leaveTypeId: application.leaveTypeId,
                            year: currentYear,
                            allocatedDays: application.leaveType.annualAllocation,
                            usedDays: application.totalDays,
                            carriedForward: 0,
                        }
                    });
                }

                // Auto-mark attendance as "on_leave"
                const weekendDays = getWeekendDays(application.employee.organization?.settings);
                const holidays = await fetchHolidays(tx, auth.organizationId, application.fromDate.getFullYear());

                if (application.toDate.getFullYear() !== application.fromDate.getFullYear()) {
                    const nextYearHolidays = await fetchHolidays(
                        tx, auth.organizationId, application.toDate.getFullYear()
                    );
                    holidays.push(...nextYearHolidays);
                }

                const holidaySet = new Set(
                    holidays.map((h) => {
                        const d = new Date(h.date);
                        d.setHours(0, 0, 0, 0);
                        return d.toISOString().split("T")[0];
                    })
                );

                const allDays = eachDayOfInterval({
                    start: application.fromDate,
                    end: application.toDate,
                });

                for (const day of allDays) {
                    const dayOfWeek = day.getDay();
                    const dateStr = day.toISOString().split("T")[0];

                    if (weekendDays.includes(dayOfWeek)) continue;
                    if (holidaySet.has(dateStr)) continue;

                    const normalizedDate = new Date(day);
                    normalizedDate.setHours(0, 0, 0, 0);

                    await tx.attendance.upsert({
                        where: {
                            employeeId_date: {
                                employeeId: application.employeeId,
                                date: normalizedDate,
                            },
                        },
                        create: {
                            employeeId: application.employeeId,
                            date: normalizedDate,
                            status: application.halfDay ? "half_day" : "on_leave",
                            source: "system",
                            notes: `Auto-marked: ${application.leaveType.name} leave`,
                        },
                        update: {
                            status: application.halfDay ? "half_day" : "on_leave",
                            source: "system",
                            notes: `Auto-marked: ${application.leaveType.name} leave`,
                        },
                    });
                }
            }

            // ── If Cancelled from Approved → Revert Balance + Cleanup Attendance ──
            if (status === "cancelled" && application.status === "approved") {
                const allocation = await tx.leaveAllocation.findUnique({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId: application.employeeId,
                            leaveTypeId: application.leaveTypeId,
                            year: currentYear,
                        },
                    },
                });

                if (allocation) {
                    await tx.leaveAllocation.update({
                        where: { id: allocation.id },
                        data: { usedDays: { decrement: application.totalDays } }
                    });
                }

                const allDays = eachDayOfInterval({
                    start: application.fromDate,
                    end: application.toDate,
                });

                for (const day of allDays) {
                    const normalizedDate = new Date(day);
                    normalizedDate.setHours(0, 0, 0, 0);

                    await tx.attendance.deleteMany({
                        where: {
                            employeeId: application.employeeId,
                            date: normalizedDate,
                            source: "system",
                            status: { in: ["on_leave", "half_day"] },
                        },
                    });
                }
            }

            return { updatedApp, application };
        });

        // ── Send notification to the applicant (outside transaction) ──
        const { updatedApp, application } = result;
        const employeeUserId = application.employee.user?.id;

        if (employeeUserId) {
            const notificationData = {
                applicantName: `${application.employee.firstName} ${application.employee.lastName}`,
                leaveTypeName: application.leaveType.name,
                fromDate: format(application.fromDate, "dd MMM yyyy"),
                toDate: format(application.toDate, "dd MMM yyyy"),
                totalDays: application.totalDays,
                rejectionReason: managerComment || undefined,
            };

            const notificationType =
                status === "approved" ? "leave_approved" as const :
                    status === "rejected" ? "leave_rejected" as const :
                        "leave_cancelled" as const;

            await createLeaveNotification(
                prisma,
                notificationType,
                employeeUserId,
                notificationData,
                application.id
            );
        }

        return NextResponse.json(updatedApp);

    } catch (error) {
        leaveLogger.error({ err: error }, "UPDATE_LEAVE_APPLICATION_ERROR");
        return new NextResponse(error instanceof Error ? error.message : "Internal Error", { status: 500 });
    }
}

// ── Helper: Handle approval side-effects (balance deduction + attendance marking) ──
async function handleApproval(leaveApplicationId: string, organizationId: string) {
    try {
        const application = await prisma.leaveApplication.findUnique({
            where: { id: leaveApplicationId },
            include: {
                leaveType: true,
                employee: {
                    include: { organization: { select: { settings: true } } },
                },
            },
        });

        if (!application) return;

        const currentYear = new Date().getFullYear();

        // Deduct from allocation
        const allocation = await prisma.leaveAllocation.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId: application.employeeId,
                    leaveTypeId: application.leaveTypeId,
                    year: currentYear,
                },
            },
        });

        if (allocation) {
            await prisma.leaveAllocation.update({
                where: { id: allocation.id },
                data: { usedDays: { increment: application.totalDays } },
            });
        }

        // Auto-mark attendance
        const weekendDays = getWeekendDays(application.employee.organization?.settings);
        const holidays = await fetchHolidays(prisma, organizationId, application.fromDate.getFullYear());

        const holidaySet = new Set(
            holidays.map((h) => new Date(h.date).toISOString().split("T")[0])
        );

        const allDays = eachDayOfInterval({
            start: application.fromDate,
            end: application.toDate,
        });

        for (const day of allDays) {
            const dayOfWeek = day.getDay();
            const dateStr = day.toISOString().split("T")[0];
            if (weekendDays.includes(dayOfWeek)) continue;
            if (holidaySet.has(dateStr)) continue;

            const normalizedDate = new Date(day);
            normalizedDate.setHours(0, 0, 0, 0);

            await prisma.attendance.upsert({
                where: {
                    employeeId_date: {
                        employeeId: application.employeeId,
                        date: normalizedDate,
                    },
                },
                create: {
                    employeeId: application.employeeId,
                    date: normalizedDate,
                    status: application.halfDay ? "half_day" : "on_leave",
                    source: "system",
                    notes: `Auto-marked: ${application.leaveType.name} leave`,
                },
                update: {
                    status: application.halfDay ? "half_day" : "on_leave",
                    source: "system",
                    notes: `Auto-marked: ${application.leaveType.name} leave`,
                },
            });
        }
    } catch (error) {
        leaveLogger.error({ err: error }, "HANDLE_APPROVAL_ERROR");
    }
}

// ── Helper: Handle cancellation side-effects (balance revert + attendance cleanup) ──
async function handleCancellation(leaveApplicationId: string, organizationId: string) {
    try {
        const application = await prisma.leaveApplication.findUnique({
            where: { id: leaveApplicationId },
            include: { leaveType: true },
        });
        if (!application) return;

        const currentYear = new Date().getFullYear();
        const allocation = await prisma.leaveAllocation.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId: application.employeeId,
                    leaveTypeId: application.leaveTypeId,
                    year: currentYear,
                },
            },
        });

        if (allocation) {
            await prisma.leaveAllocation.update({
                where: { id: allocation.id },
                data: { usedDays: { decrement: application.totalDays } },
            });
        }

        const allDays = eachDayOfInterval({
            start: application.fromDate,
            end: application.toDate,
        });

        for (const day of allDays) {
            const normalizedDate = new Date(day);
            normalizedDate.setHours(0, 0, 0, 0);
            await prisma.attendance.deleteMany({
                where: {
                    employeeId: application.employeeId,
                    date: normalizedDate,
                    source: "system",
                    status: { in: ["on_leave", "half_day"] },
                },
            });
        }
    } catch (error) {
        leaveLogger.error({ err: error }, "HANDLE_CANCELLATION_ERROR");
    }
}

// ── Helper: Notify applicant of status change ──
async function notifyApplicant(leaveApplicationId: string, status: string, comment?: string) {
    try {
        const application = await prisma.leaveApplication.findUnique({
            where: { id: leaveApplicationId },
            include: {
                leaveType: true,
                employee: { include: { user: { select: { id: true } } } },
            },
        });
        if (!application?.employee.user?.id) return;

        const notificationData = {
            applicantName: `${application.employee.firstName} ${application.employee.lastName}`,
            leaveTypeName: application.leaveType.name,
            fromDate: format(application.fromDate, "dd MMM yyyy"),
            toDate: format(application.toDate, "dd MMM yyyy"),
            totalDays: application.totalDays,
            rejectionReason: comment || undefined,
        };

        const notificationType =
            status === "approved" ? "leave_approved" as const :
                status === "rejected" ? "leave_rejected" as const :
                    "leave_cancelled" as const;

        await createLeaveNotification(
            prisma,
            notificationType,
            application.employee.user.id,
            notificationData,
            application.id
        );
    } catch (error) {
        leaveLogger.error({ err: error }, "NOTIFY_APPLICANT_ERROR");
    }
}
