import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { leaveLogger } from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

function normalizeLeaveTypePayload(json: Record<string, unknown>): Record<string, unknown> {
    const {
        isProRata,
        requireDocument,
        maxCarryForward,
        ...rest
    } = json;

    return {
        ...rest,
        ...(isProRata !== undefined ? { proRataEnabled: Boolean(isProRata) } : {}),
        ...(requireDocument !== undefined ? { requiresDocument: Boolean(requireDocument) } : {}),
        ...(maxCarryForward !== undefined
            ? { carryForwardLimit: maxCarryForward === "" || maxCarryForward === null ? null : Number(maxCarryForward) }
            : {}),
    };
}

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
        const authContext = await requireAdminOrHR();
        if (!isAuthenticated(authContext)) return authContext;

        const { id } = await params;
        const json = await req.json();
        const payload = normalizeLeaveTypePayload(json);
        const code = typeof payload.code === "string" ? payload.code.trim() : undefined;
        const { code: _code, ...rest } = payload;
        void _code;

        // Check unique code if changed
        if (code) {
            const existingCode = await prisma.leaveType.findFirst({
                where: {
                    organizationId: authContext.organizationId,
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
                organizationId: authContext.organizationId,
            },
            data: {
                code,
                ...rest,
            } as Prisma.LeaveTypeUncheckedUpdateInput,
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
        const authContext = await requireAdminOrHR();
        if (!isAuthenticated(authContext)) return authContext;

        const { id } = await params;

        const leaveType = await prisma.leaveType.findFirst({
            where: { id, organizationId: authContext.organizationId },
            select: { id: true },
        });

        if (!leaveType) {
            return new NextResponse("Leave type not found", { status: 404 });
        }

        // Check if leave type is being used in applications or allocations
        const [applicationCount, allocationCount] = await Promise.all([
            prisma.leaveApplication.count({
                where: {
                    leaveTypeId: id,
                    employee: { organizationId: authContext.organizationId },
                },
            }),
            prisma.leaveAllocation.count({
                where: {
                    leaveTypeId: id,
                    employee: { organizationId: authContext.organizationId },
                },
            }),
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
                id: leaveType.id,
            },
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        leaveLogger.error({ err: error }, "DELETE_LEAVE_TYPE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
