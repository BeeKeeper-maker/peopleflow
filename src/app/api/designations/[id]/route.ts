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

        const designation = await auth.withDB((db) =>
            db.designation.findUnique({
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

        if (!designation) {
            return new NextResponse("Designation not found", { status: 404 });
        }

        return NextResponse.json(designation);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_DESIGNATION_ERROR");
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
            const existingCode = await auth.withDB((db) =>
                db.designation.findFirst({
                    where: {
                        organizationId: auth.organizationId,
                        code,
                        NOT: { id },
                    },
                }),
            );

            if (existingCode) {
                return new NextResponse("Designation code already exists", { status: 409 });
            }
        }

        const designation = await auth.withDB((db) =>
            db.designation.update({
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

        return NextResponse.json(designation);
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_DESIGNATION_ERROR");
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
        const designation = await auth.withDB((db) =>
            db.designation.findUnique({
                where: { id, organizationId: auth.organizationId },
                include: { _count: { select: { employees: true } } }
            }),
        );

        if (!designation) {
            return new NextResponse("Designation not found", { status: 404 });
        }

        if (designation._count.employees > 0) {
            return new NextResponse("Cannot delete designation with assigned employees", { status: 400 });
        }

        await auth.withDB((db) =>
            db.designation.delete({
                where: {
                    id,
                    organizationId: auth.organizationId,
                },
            }),
        );

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        apiLogger.error({ err: error }, "DELETE_DESIGNATION_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
