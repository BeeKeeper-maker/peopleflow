import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const cycle = await prisma.reviewCycle.findFirst({
            where: { id, organizationId: ctx.organizationId },
            include: {
                _count: { select: { goals: true, reviews: true } },
                reviews: {
                    include: {
                        employee: {
                            select: { id: true, firstName: true, lastName: true, employeeCode: true },
                        },
                        reviewer: {
                            select: { id: true, firstName: true, lastName: true },
                        },
                    },
                    take: 20,
                },
            },
        });

        if (!cycle) {
            return NextResponse.json({ error: "Review cycle not found" }, { status: 404 });
        }

        return NextResponse.json(cycle);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_REVIEW_CYCLE_ERROR");
        return NextResponse.json({ error: "Failed to fetch review cycle" }, { status: 500 });
    }
}

/**
 * PATCH /api/performance/review-cycles/[id] — Update cycle (status transitions)
 *
 * Status flow: draft → active → completed
 * - draft → active: opens the cycle for self/manager reviews
 * - active → completed: closes the cycle, no more reviews can be submitted
 */
export async function PATCH(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const body = await req.json();

        const cycle = await prisma.reviewCycle.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!cycle) {
            return NextResponse.json({ error: "Review cycle not found" }, { status: 404 });
        }

        // Validate status transition
        const validTransitions: Record<string, string[]> = {
            draft: ["active"],
            active: ["completed", "draft"],
            completed: [],
        };

        const newStatus = body.status;
        if (newStatus && newStatus !== cycle.status) {
            if (!validTransitions[cycle.status]?.includes(newStatus)) {
                return NextResponse.json(
                    {
                        error: `Cannot transition from "${cycle.status}" to "${newStatus}"`,
                        code: "INVALID_TRANSITION",
                    },
                    { status: 400 },
                );
            }
        }

        const updated = await prisma.reviewCycle.update({
            where: { id },
            data: {
                ...(body.status && { status: body.status }),
                ...(body.name !== undefined && { name: body.name }),
                ...(body.description !== undefined && { description: body.description }),
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_REVIEW_CYCLE_ERROR");
        return NextResponse.json({ error: "Failed to update review cycle" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const cycle = await prisma.reviewCycle.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!cycle) {
            return NextResponse.json({ error: "Review cycle not found" }, { status: 404 });
        }

        if (cycle.status === "active") {
            return NextResponse.json(
                { error: "Cannot delete an active review cycle. Complete it first." },
                { status: 400 },
            );
        }

        await prisma.reviewCycle.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "DELETE_REVIEW_CYCLE_ERROR");
        return NextResponse.json({ error: "Failed to delete review cycle" }, { status: 500 });
    }
}
