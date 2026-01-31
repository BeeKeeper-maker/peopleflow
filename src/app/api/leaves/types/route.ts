import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
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
        console.error("GET_LEAVE_TYPES_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
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

        const json = await req.json();
        const { code, ...rest } = json;

        // Check if code exists
        const existingCode = await prisma.leaveType.findFirst({
            where: {
                organizationId: user.organizationId,
                code,
            },
        });

        if (existingCode) {
            return new NextResponse("Leave type code already exists", { status: 409 });
        }

        const leaveType = await prisma.leaveType.create({
            data: {
                code,
                organizationId: user.organizationId,
                ...rest,
            },
        });

        return NextResponse.json(leaveType);
    } catch (error) {
        console.error("CREATE_LEAVE_TYPE_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
