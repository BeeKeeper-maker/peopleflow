import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, requireAdminOrHR } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { submitRegularization, processRegularization } from "@/lib/attendance-engine";

// Valid statuses for regularization requests
const VALID_STATUSES = ["present", "absent", "half_day", "on_leave", "late"];

/**
 * POST - Submit attendance regularization request (any authenticated employee)
 */
export async function POST(req: Request) {
    try {
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const body = await req.json();
        const { date, requestedStatus, requestedCheckIn, requestedCheckOut, reason } = body;

        // ✅ Input validation
        if (!date) {
            return NextResponse.json({ error: "Date is required" }, { status: 400 });
        }

        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
        }

        if (!requestedStatus || typeof requestedStatus !== "string") {
            return NextResponse.json({ error: "Requested status is required" }, { status: 400 });
        }

        if (!VALID_STATUSES.includes(requestedStatus)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
                { status: 400 }
            );
        }

        if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
            return NextResponse.json(
                { error: "Reason is required (minimum 5 characters)" },
                { status: 400 }
            );
        }

        // ✅ Org-scoping: get employee for this user
        const employee = await prisma.employee.findFirst({
            where: { userId: ctx.userId, organizationId: ctx.organizationId },
            select: { id: true },
        });

        if (!employee) {
            return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
        }

        const result = await submitRegularization({
            employeeId: employee.id,
            date: parsedDate,
            requestedStatus,
            requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : undefined,
            requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : undefined,
            reason: reason.trim(),
        });

        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch (error) {
        console.error("Regularization submit error:", error);
        return NextResponse.json(
            { error: "Failed to submit regularization" },
            { status: 500 }
        );
    }
}

/**
 * PUT - Approve/reject regularization (admin/HR only)
 */
export async function PUT(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;

        const body = await req.json();
        const { attendanceId, action, requestedStatus, requestedCheckIn, requestedCheckOut } = body;

        // ✅ Input validation
        if (!attendanceId || typeof attendanceId !== "string") {
            return NextResponse.json({ error: "Attendance ID is required" }, { status: 400 });
        }

        if (!action || !["approve", "reject"].includes(action)) {
            return NextResponse.json(
                { error: "Action must be 'approve' or 'reject'" },
                { status: 400 }
            );
        }

        if (action === "approve" && requestedStatus && !VALID_STATUSES.includes(requestedStatus)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
                { status: 400 }
            );
        }

        // Get approver employee ID
        const approverEmployee = await prisma.employee.findFirst({
            where: { userId: (auth as AuthContext).userId },
            select: { id: true },
        });

        const result = await processRegularization(
            attendanceId,
            action,
            approverEmployee?.id || (auth as AuthContext).userId,
            requestedStatus,
            requestedCheckIn ? new Date(requestedCheckIn) : undefined,
            requestedCheckOut ? new Date(requestedCheckOut) : undefined
        );

        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch (error) {
        console.error("Regularization process error:", error);
        return NextResponse.json(
            { error: "Failed to process regularization" },
            { status: 500 }
        );
    }
}
