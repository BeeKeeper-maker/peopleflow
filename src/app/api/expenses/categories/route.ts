import { NextRequest, NextResponse } from "next/server";
import { withTenant, withPlatform } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { apiLogger } from "@/lib/logger";

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
    // New fields
    categoryType: z.enum(["standard", "mileage", "per_diem"]).default("standard"),
    mileageRate: z.number().positive().optional(),
    perDiemRate: z.number().positive().optional(),
});

// GET - List expense categories
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await withPlatform((db) =>
            db.user.findUnique({
                where: { id: session.user.id },
                select: { organizationId: true },
            }),
        );

        if (!user?.organizationId) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        const orgId = user.organizationId;
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get("active") === "true";

        const categories = await withTenant(orgId, (db) =>
            db.expenseCategory.findMany({
                where: {
                    organizationId: orgId,
                    ...(activeOnly && { isActive: true }),
                },
                orderBy: { name: "asc" },
            }),
        );

        return NextResponse.json(categories);
    } catch (error) {
        apiLogger.error({ err: error }, "Error fetching expense categories:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST - Create expense category
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await withPlatform((db) =>
            db.user.findUnique({
                where: { id: session.user.id },
                select: { organizationId: true, role: true },
            }),
        );

        if (!user?.organizationId) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        const orgId = user.organizationId;

        // Only HR/Admin can create categories
        if (!["admin", "hr_admin", "super_admin"].includes(user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const validatedData = categorySchema.parse(body);

        // Validate type-specific fields
        if (validatedData.categoryType === "mileage" && !validatedData.mileageRate) {
            return NextResponse.json(
                { error: "Mileage rate is required for mileage categories" },
                { status: 400 },
            );
        }
        if (validatedData.categoryType === "per_diem" && !validatedData.perDiemRate) {
            return NextResponse.json(
                { error: "Per-diem rate is required for per-diem categories" },
                { status: 400 },
            );
        }

        const category = await withTenant(orgId, (db) =>
            db.expenseCategory.create({
                data: {
                    ...validatedData,
                    organizationId: orgId,
                },
            }),
        );

        return NextResponse.json(category, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        apiLogger.error({ err: error }, "Error creating expense category:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
