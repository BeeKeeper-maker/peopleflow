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

        const department = await prisma.department.findUnique({
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

        if (!department) {
            return new NextResponse("Department not found", { status: 404 });
        }

        return NextResponse.json(department);
    } catch (error) {
        console.error("GET_DEPARTMENT_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require HR admin role for updating departments
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
            const existingCode = await prisma.department.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    code,
                    NOT: { id },
                },
            });

            if (existingCode) {
                return new NextResponse("Department code already exists", { status: 409 });
            }
        }

        const department = await prisma.department.update({
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

        return NextResponse.json(department);
    } catch (error) {
        console.error("UPDATE_DEPARTMENT_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require HR admin role for deleting departments
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const { id } = await params;

        // Check if department has employees
        const department = await prisma.department.findUnique({
            where: { id, organizationId: auth.organizationId },
            include: { _count: { select: { employees: true } } }
        });

        if (!department) {
            return new NextResponse("Department not found", { status: 404 });
        }

        if (department._count.employees > 0) {
            return new NextResponse("Cannot delete department with assigned employees", { status: 400 });
        }

        await prisma.department.delete({
            where: {
                id,
                organizationId: auth.organizationId,
            },
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("DELETE_DEPARTMENT_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
