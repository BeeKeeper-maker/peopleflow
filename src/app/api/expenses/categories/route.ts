import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const categorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    nameBn: z.string().optional(),
    description: z.string().optional(),
    maxAmount: z.number().positive().optional(),
    monthlyLimit: z.number().positive().optional(),
    requiresReceipt: z.boolean().default(true),
    isActive: z.boolean().default(true),
    icon: z.string().optional(),
    color: z.string().optional(),
});

// GET - List expense categories
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { organizationId: true },
        });

        if (!user?.organizationId) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get("active") === "true";

        const categories = await prisma.expenseCategory.findMany({
            where: {
                organizationId: user.organizationId,
                ...(activeOnly && { isActive: true }),
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json(categories);
    } catch (error) {
        console.error("Error fetching expense categories:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST - Create expense category
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { organizationId: true, role: true },
        });

        if (!user?.organizationId) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        // Only HR/Admin can create categories
        if (!["admin", "hr_admin", "super_admin"].includes(user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const validatedData = categorySchema.parse(body);

        const category = await prisma.expenseCategory.create({
            data: {
                ...validatedData,
                organizationId: user.organizationId,
            },
        });

        return NextResponse.json(category, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Error creating expense category:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
