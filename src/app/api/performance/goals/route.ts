import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createGoalSchema } from "@/lib/validations/goal";
import { errorResponse, successResponse, createdResponse, ErrorCodes } from "@/lib/api-response";
import { apiLogger } from "@/lib/logger";

// GET - List goals
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return errorResponse(ErrorCodes.UNAUTHORIZED, "Authentication required");
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { employee: true },
        });

        if (!user?.organizationId) {
            return errorResponse(ErrorCodes.NOT_FOUND, "Organization not found");
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const employeeId = searchParams.get("employeeId");
        const myGoals = searchParams.get("my") === "true";

        const where: Record<string, unknown> = { organizationId: user.organizationId };

        if (status) where.status = status;
        if (employeeId) where.employeeId = employeeId;
        if (myGoals && user.employee) where.employeeId = user.employee.id;

        const goals = await prisma.goal.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, photoUrl: true },
                },
                keyResults: true,
                reviewCycle: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return successResponse(goals);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_GOALS_ERROR");
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch goals");
    }
}

// POST - Create a new goal
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return errorResponse(ErrorCodes.UNAUTHORIZED, "Authentication required");
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { employee: true },
        });

        if (!user?.organizationId) {
            return errorResponse(ErrorCodes.NOT_FOUND, "Organization not found");
        }

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
        const targetEmployeeId = body.employeeId || user.employee?.id || null;

        const goal = await prisma.goal.create({
            data: {
                title: body.title,
                description: body.description || null,
                type: body.type,
                priority: body.priority,
                startDate: body.startDate,
                dueDate: body.dueDate,
                employeeId: targetEmployeeId,
                reviewCycleId: body.reviewCycleId || null,
                organizationId: user.organizationId,
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
        });

        return createdResponse(goal, "Goal created successfully");
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_GOAL_ERROR");
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return errorResponse(ErrorCodes.INTERNAL_ERROR, `Failed to create goal: ${errorMessage}`);
    }
}
