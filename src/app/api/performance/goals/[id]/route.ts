import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated, type AuthContext } from "@/lib/api-auth";
import { errorResponse, ErrorCodes } from "@/lib/api-response";
import { apiLogger } from "@/lib/logger";

/**
 * Verify that the caller is allowed to access a given goal.
 *
 *   - super_admin / admin / hr_admin → always allowed (within their org)
 *   - manager → allowed if the goal belongs to them or one of their reportees
 *   - employee → allowed only if the goal belongs to them
 *
 * Returns the goal (with employee + keyResults + reviewCycle included) if
 * access is granted, otherwise null.
 */
async function getGoalIfAccessible(
    auth: AuthContext,
    id: string,
): Promise<Record<string, unknown> | null> {
    const goal = await auth.withDB((db) =>
        db.goal.findFirst({
            where: { id, organizationId: auth.organizationId },
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, photoUrl: true },
                },
                keyResults: true,
                reviewCycle: { select: { id: true, name: true } },
            },
        }),
    );

    if (!goal) return null;

    // Elevated roles can see any goal in the org.
    if (["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return goal as Record<string, unknown>;
    }

    const goalEmployeeId = goal.employeeId ?? null;

    // Employee can only see their own goals.
    if (auth.role === "employee") {
        return goalEmployeeId && goalEmployeeId === auth.employeeId
            ? (goal as Record<string, unknown>)
            : null;
    }

    // Manager: own goals + reportees' goals.
    if (auth.role === "manager" && auth.employeeId) {
        if (goalEmployeeId === auth.employeeId) {
            return goal as Record<string, unknown>;
        }
        if (goalEmployeeId) {
            const reportee = await auth.withDB((db) =>
                db.employee.findFirst({
                    where: {
                        id: goalEmployeeId,
                        reportingManagerId: auth.employeeId,
                        organizationId: auth.organizationId,
                        deletedAt: null,
                    },
                    select: { id: true },
                }),
            );
            if (reportee) return goal as Record<string, unknown>;
        }
        return null;
    }

    return null;
}

// GET - Get goal details
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { id } = await params;

        const goal = await getGoalIfAccessible(auth, id);
        if (!goal) {
            return errorResponse(ErrorCodes.NOT_FOUND, "Goal not found");
        }

        return NextResponse.json(goal);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "GET_GOAL_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}

// PATCH - Update goal
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { id } = await params;

        const existingGoal = await getGoalIfAccessible(auth, id);
        if (!existingGoal) {
            return errorResponse(ErrorCodes.NOT_FOUND, "Goal not found");
        }

        const body = await req.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};

        const allowedFields = [
            "title", "description", "type", "priority", "status", "progress",
            "startDate", "dueDate", "reviewCycleId"
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        // Handle date fields
        if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
        if (updateData.dueDate) updateData.dueDate = new Date(updateData.dueDate);

        // Handle completion
        if (body.status === "completed" && (existingGoal as { status?: string }).status !== "completed") {
            updateData.completedAt = new Date();
            updateData.progress = 100;
        }

        const goal = await auth.withDB((db) => db.goal.update({
            where: { id },
            data: updateData,
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true },
                },
                keyResults: true,
            },
        }));

        return NextResponse.json(goal);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "UPDATE_GOAL_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}

// DELETE - Delete goal
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { id } = await params;

        const existingGoal = await getGoalIfAccessible(auth, id);
        if (!existingGoal) {
            return errorResponse(ErrorCodes.NOT_FOUND, "Goal not found");
        }

        await auth.withDB((db) => db.goal.delete({ where: { id } }));

        return NextResponse.json({ success: true });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "DELETE_GOAL_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
