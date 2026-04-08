import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { leaveLogger } from "@/lib/logger";

export async function GET(req: Request) {
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

        const { searchParams } = new URL(req.url);
        const fetchAll = searchParams.get("all") === "true";

        const where: any = {
            organizationId: user.organizationId,
        };

        if (!fetchAll) {
            where.isActive = true;
        }

        const leaveTypes = await prisma.leaveType.findMany({
            where,
            orderBy: { name: "asc" },
        });

        return NextResponse.json(leaveTypes);
    } catch (error) {
        leaveLogger.error({ err: error }, "GET_LEAVE_TYPES_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        // Require HR admin role for creating leave types
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const json = await req.json();
        const { code, ...rest } = json;

        // Check if code exists
        const existingCode = await prisma.leaveType.findFirst({
            where: {
                organizationId: auth.organizationId,
                code,
            },
        });

        if (existingCode) {
            return new NextResponse("Leave type code already exists", { status: 409 });
        }

        const leaveType = await prisma.leaveType.create({
            data: {
                code,
                organizationId: auth.organizationId,
                ...rest,
            },
        });

        return NextResponse.json(leaveType);
    } catch (error) {
        leaveLogger.error({ err: error }, "CREATE_LEAVE_TYPE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
