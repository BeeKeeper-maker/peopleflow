import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrHR } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { emit } from "@/lib/event-bus";
import { attendanceLogger } from "@/lib/logger";

/**
 * PUT — Approve or reject a regularization request.
 *
 * When approved:
 *   1. Parses the regularization JSON from notes
 *   2. Updates the Attendance record with the requested check-in/check-out times
 *   3. Changes status to "present" (or the requested status)
 *   4. Records the approval in the notes JSON
 *
 * When rejected:
 *   1. Updates the notes JSON status to REJECTED
 *   2. Restores original attendance status if it was "absent"
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const { id } = await params;
        const body = await req.json();
        const { action } = body;

        if (!action || !["approve", "reject"].includes(action)) {
            return NextResponse.json(
                { error: "Action must be 'approve' or 'reject'" },
                { status: 400 }
            );
        }

        // Fetch the attendance record + org check
        const attendance = await prisma.attendance.findFirst({
            where: {
                id,
                employee: { organizationId: ctx.organizationId },
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        user: { select: { id: true } },
                    },
                },
            },
        });

        if (!attendance) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        // Parse existing regularization data
        let regData: Record<string, any> = {};
        try {
            const jsonStr = attendance.notes?.replace("[REGULARIZATION] ", "") || "{}";
            regData = JSON.parse(jsonStr);
        } catch {
            regData = { status: "PENDING" };
        }

        if (regData.status === "APPROVED") {
            return NextResponse.json({ error: "Already approved" }, { status: 400 });
        }

        if (regData.status === "REJECTED") {
            return NextResponse.json({ error: "Already rejected" }, { status: 400 });
        }

        // Get approver info
        const approver = await prisma.employee.findFirst({
            where: { userId: ctx.userId },
            select: { firstName: true, lastName: true },
        });
        const approverName = approver
            ? `${approver.firstName} ${approver.lastName}`
            : ctx.userId;

        if (action === "approve") {
            // Build updated attendance from regularization data
            const updateData: Record<string, any> = {
                status: regData.requestedStatus || "present",
                source: "regularization",
            };

            // Apply check-in/check-out times if provided
            if (regData.requestedCheckIn) {
                const [hours, minutes] = regData.requestedCheckIn.split(":");
                if (hours && minutes) {
                    const checkIn = new Date(attendance.date);
                    checkIn.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    updateData.checkIn = checkIn;
                }
            }

            if (regData.requestedCheckOut) {
                const [hours, minutes] = regData.requestedCheckOut.split(":");
                if (hours && minutes) {
                    const checkOut = new Date(attendance.date);
                    checkOut.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    updateData.checkOut = checkOut;
                }
            }

            // Update the approval metadata
            regData.status = "APPROVED";
            regData.approvedBy = approverName;
            regData.approvedAt = new Date().toISOString();
            updateData.notes = `[REGULARIZATION] ${JSON.stringify(regData)}`;

            // Reset late/absence penalties since attendance is being regularized
            updateData.lateMinutes = 0;
            updateData.earlyLeaveMinutes = 0;

            await prisma.attendance.update({
                where: { id },
                data: updateData,
            });

            // 🔔 Emit notification for approved regularization
            if (attendance.employee.user?.id) {
                emit("attendance.regularization.approved", {
                    userId: attendance.employee.user.id,
                    employeeName: `${attendance.employee.firstName} ${attendance.employee.lastName}`,
                    date: attendance.date.toISOString().split("T")[0],
                }).catch((err) => attendanceLogger.error({ err: err }, "[EVENT_FAIL] regularization.approved:"));
            }

            // Log the action in audit
            try {
                await prisma.auditLog.create({
                    data: {
                        action: "approve",
                        entityType: "AttendanceRegularization",
                        entityId: id,
                        userId: ctx.userId,
                        organizationId: ctx.organizationId,
                        newValues: JSON.stringify({
                            employee: `${attendance.employee.firstName} ${attendance.employee.lastName}`,
                            date: attendance.date.toISOString().split("T")[0],
                            action: "regularization_approved",
                            approvedBy: approverName,
                        }),
                    },
                });
            } catch {
                // Non-critical — don't fail the request
            }

            return NextResponse.json({
                success: true,
                message: `Regularization approved. Attendance updated to "${updateData.status}".`,
            });
        } else {
            // REJECT
            regData.status = "REJECTED";
            regData.rejectedBy = approverName;
            regData.rejectedAt = new Date().toISOString();

            await prisma.attendance.update({
                where: { id },
                data: {
                    notes: `[REGULARIZATION] ${JSON.stringify(regData)}`,
                },
            });

            // 🔔 Emit notification for rejected regularization
            if (attendance.employee.user?.id) {
                emit("attendance.regularization.rejected", {
                    userId: attendance.employee.user.id,
                    employeeName: `${attendance.employee.firstName} ${attendance.employee.lastName}`,
                    date: attendance.date.toISOString().split("T")[0],
                }).catch((err) => attendanceLogger.error({ err: err }, "[EVENT_FAIL] regularization.rejected:"));
            }

            // Log the action in audit
            try {
                await prisma.auditLog.create({
                    data: {
                        action: "reject",
                        entityType: "AttendanceRegularization",
                        entityId: id,
                        userId: ctx.userId,
                        organizationId: ctx.organizationId,
                        newValues: JSON.stringify({
                            employee: `${attendance.employee.firstName} ${attendance.employee.lastName}`,
                            date: attendance.date.toISOString().split("T")[0],
                            action: "regularization_rejected",
                            rejectedBy: approverName,
                        }),
                    },
                });
            } catch {
                // Non-critical
            }

            return NextResponse.json({
                success: true,
                message: "Regularization request rejected.",
            });
        }
    } catch (error) {
        attendanceLogger.error({ err: error }, "Regularization process error:");
        return NextResponse.json(
            { error: "Failed to process regularization" },
            { status: 500 }
        );
    }
}
