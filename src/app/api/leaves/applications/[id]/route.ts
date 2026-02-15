import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireManagerOrAbove, isAuthenticated } from "@/lib/api-auth";
import { format, eachDayOfInterval } from "date-fns";
import {
    createLeaveNotification,
    getWeekendDays,
    fetchHolidays,
} from "@/lib/leave-utils";

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
        console.error("GET_LEAVE_APPLICATION_ERROR", error);
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

        // Start Transaction
        const result = await prisma.$transaction(async (tx) => {
            // Fetch with org-level check + organization settings for weekend config
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

            // Additional check: only pending → approved/rejected, only approved → cancelled
            if (status === "approved" && application.status !== "pending") {
                throw new Error("Can only approve pending applications");
            }
            if (status === "rejected" && application.status !== "pending") {
                throw new Error("Can only reject pending applications");
            }
            if (status === "cancelled" && application.status !== "approved") {
                throw new Error("Can only cancel approved applications");
            }

            // Build update data conditionally
            const updateData: Record<string, unknown> = {
                status,
                rejectionReason: status === "rejected" ? (managerComment || null) : null,
            };

            if (status === "approved") {
                updateData.approvedAt = new Date();
                updateData.approverId = application.employee.user?.id || null;
            }

            // Update Application Status
            const updatedApp = await tx.leaveApplication.update({
                where: { id },
                data: updateData,
            });

            const currentYear = new Date().getFullYear();

            // ── If Approved → Deduct Balance + Create Attendance Records ──
            if (status === "approved" && application.status === "pending") {
                // Deduct from allocation
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
                        data: {
                            usedDays: {
                                increment: application.totalDays
                            }
                        }
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

                // ── Auto-mark attendance as "on_leave" for each working day ──
                const weekendDays = getWeekendDays(application.employee.organization?.settings);
                const holidays = await fetchHolidays(tx, auth.organizationId, application.fromDate.getFullYear());

                // Also fetch next year holidays if leave spans years
                if (application.toDate.getFullYear() !== application.fromDate.getFullYear()) {
                    const nextYearHolidays = await fetchHolidays(
                        tx,
                        auth.organizationId,
                        application.toDate.getFullYear()
                    );
                    holidays.push(...nextYearHolidays);
                }

                // Build holiday set for O(1) lookup
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

                    // Skip weekends and holidays
                    if (weekendDays.includes(dayOfWeek)) continue;
                    if (holidaySet.has(dateStr)) continue;

                    // Normalize to start of day for the unique constraint
                    const normalizedDate = new Date(day);
                    normalizedDate.setHours(0, 0, 0, 0);

                    // Upsert attendance — create if not exists, update if exists
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
                // Revert allocation
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
                        data: {
                            usedDays: {
                                decrement: application.totalDays
                            }
                        }
                    });
                }

                // ── Cleanup auto-created attendance records ──
                const allDays = eachDayOfInterval({
                    start: application.fromDate,
                    end: application.toDate,
                });

                for (const day of allDays) {
                    const normalizedDate = new Date(day);
                    normalizedDate.setHours(0, 0, 0, 0);

                    // Only delete if it was auto-marked by system
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
        console.error("UPDATE_LEAVE_APPLICATION_ERROR", error);
        return new NextResponse(error instanceof Error ? error.message : "Internal Error", { status: 500 });
    }
}
