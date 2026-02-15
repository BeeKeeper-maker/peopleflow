import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";

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

        const designation = await prisma.designation.findUnique({
            where: {
                id,
                organizationId: user.organizationId,
            },
            include: {
                _count: {
                    select: { employees: true }
                }
            }
        });

        if (!designation) {
            return new NextResponse("Designation not found", { status: 404 });
        }

        return NextResponse.json(designation);
    } catch (error) {
        console.error("GET_DESIGNATION_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require HR admin role for updating designations
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const { id } = await params;
        const json = await req.json();
        const { name, code, ...rest } = json;

        if (!name) {
            return new NextResponse("Name is required", { status: 400 });
        }

        // Check uniqueness of code if changed
        if (code) {
            const existingCode = await prisma.designation.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    code,
                    NOT: { id },
                },
            });

            if (existingCode) {
                return new NextResponse("Designation code already exists", { status: 409 });
            }
        }

        const designation = await prisma.designation.update({
            where: {
                id,
                organizationId: auth.organizationId,
            },
            data: {
                name,
                code: code || null,
                ...rest,
            },
        });

        return NextResponse.json(designation);
    } catch (error) {
        console.error("UPDATE_DESIGNATION_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require HR admin role for deleting designations
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const { id } = await params;

        // Check if designation has employees
        const designation = await prisma.designation.findUnique({
            where: { id, organizationId: auth.organizationId },
            include: { _count: { select: { employees: true } } }
        });

        if (!designation) {
            return new NextResponse("Designation not found", { status: 404 });
        }

        if (designation._count.employees > 0) {
            return new NextResponse("Cannot delete designation with assigned employees", { status: 400 });
        }

        await prisma.designation.delete({
            where: {
                id,
                organizationId: auth.organizationId,
            },
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("DELETE_DESIGNATION_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
