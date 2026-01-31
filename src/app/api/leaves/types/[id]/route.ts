import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
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
        console.error("GET_LEAVE_TYPE_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
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
        console.error("UPDATE_LEAVE_TYPE_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
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

        // Check if leave type is being used
        // TODO: Check leave applications and allocations before delete

        await prisma.leaveType.delete({
            where: {
                id,
                organizationId: user.organizationId,
            },
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("DELETE_LEAVE_TYPE_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
