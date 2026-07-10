import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";
import * as z from "zod";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;

        const review = await auth.withDB((db) => db.performanceReview.findFirst({
            where: { id, organizationId: ctx.organizationId },
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
                reviewCycle: true,
            },
        }));

        if (!review) {
            return NextResponse.json({ error: "Review not found" }, { status: 404 });
        }

        // Scope check: employee sees own, manager sees reportees, HR sees all
        const isHRLevel = ["super_admin", "admin", "hr_admin"].includes(ctx.role);
        if (!isHRLevel) {
            if (ctx.role === "employee" && review.employeeId !== ctx.employeeId) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            if (ctx.role === "manager") {
                const emp = await auth.withDB((db) => db.employee.findFirst({
                    where: { id: review.employeeId, reportingManagerId: ctx.employeeId },
                }));
                if (!emp && review.employeeId !== ctx.employeeId) {
                    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
                }
            }
        }

        return NextResponse.json(review);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_REVIEW_ERROR");
        return NextResponse.json({ error: "Failed to fetch review" }, { status: 500 });
    }
}

const submitSelfReviewSchema = z.object({
    selfRating: z.number().min(1).max(5),
    selfComments: z.string().max(5000),
});

/**
 * PATCH /api/performance/reviews/[id]?action=self — Submit self-assessment
 *
 * Only the employee being reviewed can submit their self-assessment.
 * Status transitions: pending → self_review
 */
export async function PATCH(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const url = new URL(req.url);
        const action = url.searchParams.get("action") || "self";
        const body = await req.json();

        const review = await auth.withDB((db) => db.performanceReview.findFirst({
            where: { id, organizationId: ctx.organizationId },
            include: {
                employee: { select: { id: true, firstName: true, lastName: true, reportingManagerId: true } },
                reviewCycle: { select: { id: true, name: true, status: true } },
            },
        }));

        if (!review) {
            return NextResponse.json({ error: "Review not found" }, { status: 404 });
        }

        if (review.reviewCycle.status !== "active") {
            return NextResponse.json(
                { error: "Review cycle is not active. Submissions are locked." },
                { status: 400 },
            );
        }

        if (action === "self") {
            // ── Self-assessment ──
            if (review.employeeId !== ctx.employeeId) {
                return NextResponse.json(
                    { error: "You can only submit your own self-assessment" },
                    { status: 403 },
                );
            }
            if (review.status !== "pending" && review.status !== "self_review") {
                return NextResponse.json(
                    { error: `Self-assessment already submitted` },
                    { status: 400 },
                );
            }

            const validation = submitSelfReviewSchema.safeParse(body);
            if (!validation.success) {
                return NextResponse.json(
                    { error: "Validation failed", details: validation.error.issues },
                    { status: 400 },
                );
            }

            const updated = await auth.withDB((db) => db.performanceReview.update({
                where: { id },
                data: {
                    selfRating: validation.data.selfRating,
                    selfComments: validation.data.selfComments,
                    selfSubmittedAt: new Date(),
                    status: "self_review",
                },
            }));

            await createAuditLog({
                organizationId: ctx.organizationId,
                action: "update",
                entityType: "PerformanceReview",
                entityId: id,
                newValues: { action: "self_assessment_submitted", rating: validation.data.selfRating },
                userId: ctx.userId,
            }).catch(() => {});

            return NextResponse.json({
                success: true,
                review: updated,
                message: "Self-assessment submitted. Your manager will be notified.",
            });
        } else if (action === "manager") {
            // ── Manager review ──
            const isReviewer = review.reviewerId === ctx.employeeId;
            const isHRLevel = ["super_admin", "admin", "hr_admin"].includes(ctx.role);
            const isReportingManager = review.employee.reportingManagerId === ctx.employeeId;

            if (!isReviewer && !isHRLevel && !isReportingManager) {
                return NextResponse.json(
                    { error: "Only the assigned reviewer or reporting manager can submit the manager review" },
                    { status: 403 },
                );
            }

            if (review.status !== "self_review" && review.status !== "manager_review") {
                return NextResponse.json(
                    { error: "Employee must submit self-assessment first" },
                    { status: 400 },
                );
            }

            const managerSchema = z.object({
                managerRating: z.number().min(1).max(5),
                managerComments: z.string().max(5000),
                overallRating: z.number().min(1).max(5).optional(),
                strengths: z.string().max(2000).optional(),
                improvements: z.string().max(2000).optional(),
            });

            const validation = managerSchema.safeParse(body);
            if (!validation.success) {
                return NextResponse.json(
                    { error: "Validation failed", details: validation.error.issues },
                    { status: 400 },
                );
            }

            const updated = await auth.withDB((db) => db.performanceReview.update({
                where: { id },
                data: {
                    managerRating: validation.data.managerRating,
                    managerComments: validation.data.managerComments,
                    managerSubmittedAt: new Date(),
                    overallRating:
                        validation.data.overallRating ??
                        Math.round((review.selfRating! + validation.data.managerRating) / 2),
                    strengths: validation.data.strengths || null,
                    improvements: validation.data.improvements || null,
                    status: "completed",
                },
            }));

            await createAuditLog({
                organizationId: ctx.organizationId,
                action: "update",
                entityType: "PerformanceReview",
                entityId: id,
                newValues: {
                    action: "manager_review_submitted",
                    managerRating: validation.data.managerRating,
                    overallRating: updated.overallRating,
                },
                userId: ctx.userId,
            }).catch(() => {});

            return NextResponse.json({
                success: true,
                review: updated,
                message: "Manager review submitted. Performance review completed.",
            });
        }

        return NextResponse.json({ error: "Invalid action. Use ?action=self or ?action=manager" }, { status: 400 });
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_REVIEW_ERROR");
        return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
    }
}
