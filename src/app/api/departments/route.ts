import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

export async function GET(req: Request) {
    // Authenticate first
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) {
        return auth; // Returns 401 Unauthorized
    }

    try {
        const { searchParams } = new URL(req.url);
        const fetchAll = searchParams.get("all") === "true";

        const where: Record<string, unknown> = {
            organizationId: auth.organizationId,
        };

        if (!fetchAll) {
            where.isActive = true;
        }

        const departments = await prisma.department.findMany({
            where,
            include: {
                _count: {
                    select: { employees: true }
                }
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json(departments);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_DEPARTMENTS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    // Authenticate first
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) {
        return auth; // Returns 401 Unauthorized
    }

    try {
        const json = await req.json();
        const { name, code, ...rest } = json;

        if (!name) {
            return new NextResponse("Name is required", { status: 400 });
        }

        // Check if code exists if provided
        if (code) {
            const existingCode = await prisma.department.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    code,
                },
            });

            if (existingCode) {
                return new NextResponse("Department code already exists", { status: 409 });
            }
        }

        const department = await prisma.department.create({
            data: {
                name,
                code: code || null,
                organizationId: auth.organizationId,
                ...rest,
            },
        });

        return NextResponse.json(department);
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_DEPARTMENT_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
