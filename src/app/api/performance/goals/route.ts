import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { createGoalSchema } from "@/lib/validations/goal";
import { errorResponse, successResponse, createdResponse, ErrorCodes } from "@/lib/api-response";
import { apiLogger } from "@/lib/logger";

/**
 * GET - List goals.
 *
 * Role scoping:
 *   - super_admin / admin / hr_admin → all goals in the org
 *   - manager → own goals + their reportees' goals
 *   - employee → only their own goals
 *
 * SECURITY: All DB access goes through `requireAuth()` + `auth.withDB()` so the
 * query is RLS-scoped to the caller's org and protected by sessionVersion /
 * isActive / org-status checks enforced in requireAuth().
 */
export async function GET(req: Request) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const employeeId = searchParams.get("employeeId");
        const myGoals = searchParams.get("my") === "true";

        const where: Record<string, unknown> = { organizationId: auth.organizationId };

        if (status) where.status = status;
        if (employeeId) where.employeeId = employeeId;
        if (myGoals && auth.employeeId) where.employeeId = auth.employeeId;

        // Role-based scoping: unless the caller is filtering by `my=true` or
        // explicitly to a single employee they are allowed to see, restrict the
        // list to the caller's permission envelope.
        if (!myGoals && !employeeId) {
            if (auth.role === "employee") {
                // Employees see only their own goals.
                if (auth.employeeId) {
                    where.employeeId = auth.employeeId;
                } else {
                    // No linked employee profile → return empty.
                    return successResponse([]);
                }
            } else if (auth.role === "manager" && auth.employeeId) {
                // Managers see own goals + their reportees' goals.
                const reportees = await auth.withDB((db) =>
                    db.employee.findMany({
                        where: { reportingManagerId: auth.employeeId, deletedAt: null },
                        select: { id: true },
                    }),
                );
                const reporteeIds = reportees.map((r) => r.id);
                reporteeIds.push(auth.employeeId);
                where.employeeId = { in: reporteeIds };
            }
            // super_admin / admin / hr_admin → no extra filter; see all org goals.
        }

        const goals = await auth.withDB((db) => db.goal.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, photoUrl: true },
                },
                keyResults: true,
                reviewCycle: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        }));

        return successResponse(goals);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_GOALS_ERROR");
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch goals");
    }
}

/**
 * POST - Create a new goal.
 *
 * Role scoping:
 *   - employee → may only create goals for themselves
 *   - manager → may create goals for themselves or their reportees
 *   - super_admin / admin / hr_admin → may create goals for anyone in the org
 *
 * SECURITY: All DB access goes through `requireAuth()` + `auth.withDB()`.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        // Parse and validate request body
        const json = await req.json();
        const validationResult = createGoalSchema.safeParse(json);

        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((e) => ({
                field: e.path.join("."),
                message: e.message,
            }));
            return errorResponse(ErrorCodes.VALIDATION_ERROR, "Validation failed", { details: errors });
        }

        const body = validationResult.data;

        // Default to current user's employee if not specified
        const targetEmployeeId = body.employeeId || auth.employeeId || null;

        // Enforce role scoping on the target employee.
        if (targetEmployeeId && targetEmployeeId !== auth.employeeId) {
            const isElevated = ["super_admin", "admin", "hr_admin"].includes(auth.role);
            if (!isElevated) {
                if (auth.role === "manager" && auth.employeeId) {
                    // Verify the target is a direct reportee.
                    const reportee = await auth.withDB((db) =>
                        db.employee.findFirst({
                            where: {
                                id: targetEmployeeId,
                                reportingManagerId: auth.employeeId,
                                organizationId: auth.organizationId,
                                deletedAt: null,
                            },
                            select: { id: true },
                        }),
                    );
                    if (!reportee) {
                        return errorResponse(
                            ErrorCodes.FORBIDDEN,
                            "Managers can only create goals for themselves or their direct reportees",
                        );
                    }
                } else {
                    return errorResponse(
                        ErrorCodes.FORBIDDEN,
                        "You can only create goals for yourself",
                    );
                }
            }
        }

        const goal = await auth.withDB((db) => db.goal.create({
            data: {
                title: body.title,
                description: body.description || null,
                type: body.type,
                priority: body.priority,
                startDate: body.startDate,
                dueDate: body.dueDate,
                employeeId: targetEmployeeId,
                reviewCycleId: body.reviewCycleId || null,
                organizationId: auth.organizationId,
                keyResults: body.keyResults?.length ? {
                    create: body.keyResults.map((kr) => ({
                        title: kr.title,
                        targetValue: kr.targetValue,
                        unit: kr.unit,
                    })),
                } : undefined,
            },
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true },
                },
                keyResults: true,
            },
        }));

        return createdResponse(goal, "Goal created successfully");
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_GOAL_ERROR");
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return errorResponse(ErrorCodes.INTERNAL_ERROR, `Failed to create goal: ${errorMessage}`);
    }
}
