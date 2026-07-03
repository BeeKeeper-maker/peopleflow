import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

/**
 * GET /api/performance/review-cycles — List review cycles
 */
export async function GET(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const where: Record<string, unknown> = { organizationId: ctx.organizationId };
        if (status) where.status = status;

        const cycles = await prisma.reviewCycle.findMany({
            where,
            include: {
                _count: {
                    select: { goals: true, reviews: true },
                },
            },
            orderBy: { startDate: "desc" },
        });

        return NextResponse.json({ data: cycles, total: cycles.length });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_REVIEW_CYCLES_ERROR");
        return NextResponse.json({ error: "Failed to fetch review cycles" }, { status: 500 });
    }
}

const createCycleSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    type: z.enum(["quarterly", "biannual", "annual"]),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
});

export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = createCycleSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validation.error.issues.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        const { name, description, type, startDate, endDate } = validation.data;

        if (new Date(startDate) >= new Date(endDate)) {
            return NextResponse.json(
                { error: "End date must be after start date" },
                { status: 400 },
            );
        }

        const cycle = await prisma.reviewCycle.create({
            data: {
                name,
                description,
                type,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                status: "draft",
                organizationId: ctx.organizationId,
            },
        });

        return NextResponse.json(cycle, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_REVIEW_CYCLE_ERROR");
        return NextResponse.json({ error: "Failed to create review cycle" }, { status: 500 });
    }
}
