import { NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { id } = await params;

        const department = await auth.withDB((db) =>
            db.department.findUnique({
                where: {
                    id,
                    organizationId: auth.organizationId,
                },
                include: {
                    _count: {
                        select: { employees: true }
                    }
                }
            }),
        );

        if (!department) {
            return new NextResponse("Department not found", { status: 404 });
        }

        return NextResponse.json(department);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "GET_DEPARTMENT_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
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
            const existingCode = await auth.withDB((db) =>
                db.department.findFirst({
                    where: {
                        organizationId: auth.organizationId,
                        code,
                        NOT: { id },
                    },
                }),
            );

            if (existingCode) {
                return new NextResponse("Department code already exists", { status: 409 });
            }
        }

        const department = await auth.withDB((db) =>
            db.department.update({
                where: {
                    id,
                    organizationId: auth.organizationId,
                },
                data: {
                    name,
                    code: code || null,
                    ...rest,
                },
            }),
        );

        return NextResponse.json(department);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "UPDATE_DEPARTMENT_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
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
        const department = await auth.withDB((db) =>
            db.department.findUnique({
                where: { id, organizationId: auth.organizationId },
                include: { _count: { select: { employees: true } } }
            }),
        );

        if (!department) {
            return new NextResponse("Department not found", { status: 404 });
        }

        if (department._count.employees > 0) {
            return new NextResponse("Cannot delete department with assigned employees", { status: 400 });
        }

        await auth.withDB((db) =>
            db.department.delete({
                where: {
                    id,
                    organizationId: auth.organizationId,
                },
            }),
        );

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "DELETE_DEPARTMENT_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
