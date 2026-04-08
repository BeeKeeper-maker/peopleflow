import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { leaveLogger } from "@/lib/logger";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const { id } = await params;

        const leaveType = await prisma.leaveType.findUnique({
            where: {
                id,
                organizationId: user.organizationId,
            },
        });

        if (!leaveType) {
            return new NextResponse("Leave type not found", { status: 404 });
        }

        return NextResponse.json(leaveType);
    } catch (error) {
        leaveLogger.error({ err: error }, "GET_LEAVE_TYPE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const { id } = await params;
        const json = await req.json();
        const { code, ...rest } = json;

        // Check unique code if changed
        if (code) {
            const existingCode = await prisma.leaveType.findFirst({
                where: {
                    organizationId: user.organizationId,
                    code,
                    NOT: { id },
                },
            });

            if (existingCode) {
                return new NextResponse("Leave type code already exists", { status: 409 });
            }
        }

        const leaveType = await prisma.leaveType.update({
            where: {
                id,
                organizationId: user.organizationId,
            },
            data: {
                code,
                ...rest,
            },
        });

        return NextResponse.json(leaveType);
    } catch (error) {
        leaveLogger.error({ err: error }, "UPDATE_LEAVE_TYPE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const { id } = await params;

        // Check if leave type is being used in applications or allocations
        const [applicationCount, allocationCount] = await Promise.all([
            prisma.leaveApplication.count({ where: { leaveTypeId: id } }),
            prisma.leaveAllocation.count({ where: { leaveTypeId: id } }),
        ]);

        if (applicationCount > 0 || allocationCount > 0) {
            return new NextResponse(
                JSON.stringify({
                    error: `Cannot delete: this leave type has ${applicationCount} application(s) and ${allocationCount} allocation(s) associated with it. Remove them first.`,
                }),
                { status: 409, headers: { "Content-Type": "application/json" } }
            );
        }

        await prisma.leaveType.delete({
            where: {
                id,
                organizationId: user.organizationId,
            },
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        leaveLogger.error({ err: error }, "DELETE_LEAVE_TYPE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
