import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - Get goal details
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 404 });
        }

        const goal = await prisma.goal.findFirst({
            where: { id, organizationId: user.organizationId },
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, photoUrl: true },
                },
                keyResults: true,
                reviewCycle: { select: { id: true, name: true } },
            },
        });

        if (!goal) {
            return new NextResponse("Goal not found", { status: 404 });
        }

        return NextResponse.json(goal);
    } catch (error) {
        console.error("GET_GOAL_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// PATCH - Update goal
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 404 });
        }

        const existingGoal = await prisma.goal.findFirst({
            where: { id, organizationId: user.organizationId },
        });

        if (!existingGoal) {
            return new NextResponse("Goal not found", { status: 404 });
        }

        const body = await req.json();
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
        if (body.status === "completed" && existingGoal.status !== "completed") {
            updateData.completedAt = new Date();
            updateData.progress = 100;
        }

        const goal = await prisma.goal.update({
            where: { id },
            data: updateData,
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true },
                },
                keyResults: true,
            },
        });

        return NextResponse.json(goal);
    } catch (error) {
        console.error("UPDATE_GOAL_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// DELETE - Delete goal
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 404 });
        }

        const existingGoal = await prisma.goal.findFirst({
            where: { id, organizationId: user.organizationId },
        });

        if (!existingGoal) {
            return new NextResponse("Goal not found", { status: 404 });
        }

        await prisma.goal.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE_GOAL_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
