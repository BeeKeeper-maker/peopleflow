import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

// GET /api/branches — List all branches
export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const branches = await prisma.branch.findMany({
            where: { organizationId: auth.organizationId },
            include: {
                _count: {
                    select: { employees: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(branches);
    } catch (error) {
        console.error("GET_BRANCHES_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST /api/branches — Create a new branch
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const json = await req.json();
        const { name, code, address, city, phone, email, isHeadOffice } = json;

        if (!name) {
            return NextResponse.json(
                { error: "Branch name is required" },
                { status: 400 }
            );
        }

        // Check for duplicate code
        if (code) {
            const existing = await prisma.branch.findUnique({
                where: {
                    organizationId_code: {
                        organizationId: auth.organizationId,
                        code,
                    },
                },
            });

            if (existing) {
                return NextResponse.json(
                    { error: "A branch with this code already exists" },
                    { status: 409 }
                );
            }
        }

        const branch = await prisma.branch.create({
            data: {
                name,
                code: code || undefined,
                address: address || null,
                city: city || null,
                phone: phone || null,
                email: email || null,
                isHeadOffice: isHeadOffice || false,
                organizationId: auth.organizationId,
            },
        });

        return NextResponse.json(branch);
    } catch (error) {
        console.error("CREATE_BRANCH_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
