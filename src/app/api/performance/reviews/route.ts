import { NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import * as z from "zod";

/**
 * GET /api/performance/reviews — List performance reviews
 *
 * Query params:
 *   - reviewCycleId: filter by cycle
 *   - employeeId: filter by employee
 *   - status: pending, self_review, manager_review, completed
 *
 * Authorization:
 *   - admin/hr: see all org reviews
 *   - manager: see reviews for direct reportees
 *   - employee: see own reviews only
 */
export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    // Per-user rate limit (read op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, ctx.userId);
    if (!rl.allowed) return rl.response!;

    try {
        const { searchParams } = new URL(req.url);
        const reviewCycleId = searchParams.get("reviewCycleId");
        const employeeId = searchParams.get("employeeId");
        const status = searchParams.get("status");
        const myReviews = searchParams.get("my") === "true";

        const where: Record<string, unknown> = {
            organizationId: ctx.organizationId,
        };

        if (reviewCycleId) where.reviewCycleId = reviewCycleId;
        if (status) where.status = status;

        // Role-based scoping
        const isHRLevel = ["super_admin", "admin", "hr_admin"].includes(ctx.role);
        if (!isHRLevel) {
            if (myReviews || ctx.role === "employee") {
                where.employeeId = ctx.employeeId;
            } else if (ctx.role === "manager" && ctx.employeeId) {
                // Manager sees reviews for direct reportees
                const reportees = await ctx.withDB((db) =>
                    db.employee.findMany({
                        where: { reportingManagerId: ctx.employeeId, organizationId: ctx.organizationId },
                        select: { id: true },
                    }),
                );
                where.employeeId = { in: [ctx.employeeId, ...reportees.map((r) => r.id)] };
            }
        }

        if (employeeId) where.employeeId = employeeId;

        const reviews = await ctx.withDB((db) =>
            db.performanceReview.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeCode: true,
                            photoUrl: true,
                            designation: { select: { name: true } },
                            department: { select: { name: true } },
                        },
                    },
                    reviewer: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    reviewCycle: {
                        select: { id: true, name: true, type: true, status: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
        );

        return NextResponse.json({ data: reviews, total: reviews.length });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_REVIEWS_ERROR");
        return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }
}

const createReviewSchema = z.object({
    employeeId: z.string().min(1),
    reviewCycleId: z.string().min(1),
    reviewerId: z.string().optional(),
});

/**
 * POST /api/performance/reviews — Create a performance review (HR assigns)
 *
 * HR creates reviews for employees in a cycle. Each review tracks:
 *   - Self-assessment (submitted by employee)
 *   - Manager assessment (submitted by reviewer)
 *   - Overall rating + strengths + improvements
 */
export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = createReviewSchema.safeParse(body);

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

        const { employeeId, reviewCycleId, reviewerId } = validation.data;

        // Verify employee + cycle belong to org
        const [employee, cycle] = await ctx.withDB((db) =>
            Promise.all([
                db.employee.findFirst({
                    where: { id: employeeId, organizationId: ctx.organizationId },
                }),
                db.reviewCycle.findFirst({
                    where: { id: reviewCycleId, organizationId: ctx.organizationId },
                }),
            ]),
        );

        if (!employee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }
        if (!cycle) {
            return NextResponse.json({ error: "Review cycle not found" }, { status: 404 });
        }
        if (cycle.status !== "active") {
            return NextResponse.json(
                { error: `Review cycle is ${cycle.status}. Only active cycles accept reviews.` },
                { status: 400 },
            );
        }

        // Check for duplicate review
        const existing = await ctx.withDB((db) =>
            db.performanceReview.findUnique({
                where: {
                    employeeId_reviewCycleId: { employeeId, reviewCycleId },
                },
            }),
        );
        if (existing) {
            return NextResponse.json(
                { error: "A review already exists for this employee in this cycle", code: "DUPLICATE" },
                { status: 409 },
            );
        }

        // Default reviewer = employee's reporting manager
        const finalReviewerId = reviewerId || employee.reportingManagerId;

        const review = await ctx.withDB((db) =>
            db.performanceReview.create({
                data: {
                    employeeId,
                    reviewCycleId,
                    reviewerId: finalReviewerId || null,
                    status: "pending",
                    organizationId: ctx.organizationId,
                },
                include: {
                    employee: {
                        select: { id: true, firstName: true, lastName: true, employeeCode: true },
                    },
                    reviewCycle: { select: { id: true, name: true } },
                },
            }),
        );

        return NextResponse.json(review, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_REVIEW_ERROR");
        return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
    }
}
