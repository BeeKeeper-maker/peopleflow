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

        const designations = await prisma.designation.findMany({
            where,
            include: {
                _count: {
                    select: { employees: true }
                }
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json(designations);
    } catch (error) {
        console.error("GET_DESIGNATIONS_ERROR", error);
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
        const { name, code, ...rest } = json;

        if (!name) {
            return new NextResponse("Name is required", { status: 400 });
        }

        // Check uniqueness of code if provided
        if (code) {
            const existingCode = await prisma.designation.findFirst({
                where: {
                    organizationId: user.organizationId,
                    code,
                },
            });

            if (existingCode) {
                return new NextResponse("Designation code already exists", { status: 409 });
            }
        }

        const designation = await prisma.designation.create({
            data: {
                name,
                code: code || null,
                organizationId: user.organizationId,
                ...rest,
            },
        });

        return NextResponse.json(designation);
    } catch (error) {
        console.error("CREATE_DESIGNATION_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
