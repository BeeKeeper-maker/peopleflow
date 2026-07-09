import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS, applyRateLimitHeaders } from "@/lib/rate-limit";
import * as z from "zod";

/**
 * GET /api/recruitment/applications — List applications (pipeline view)
 *
 * Query params:
 *   - jobPostingId: filter by job
 *   - stage: applied, screening, interview, technical, hr, offer, hired, rejected
 *   - status: pending, in_progress, passed, failed, withdrawn
 */
export async function GET(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    // Per-user rate limit (read op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, ctx.userId);
    if (!rl.allowed) return rl.response!;

    try {
        const { searchParams } = new URL(req.url);
        const jobPostingId = searchParams.get("jobPostingId");
        const stage = searchParams.get("stage");
        const status = searchParams.get("status");

        const where: Record<string, unknown> = {
            organizationId: ctx.organizationId,
        };

        if (jobPostingId) where.jobPostingId = jobPostingId;
        if (stage) where.stage = stage;
        if (status) where.status = status;

        const applications = await ctx.withDB((db) =>
            db.application.findMany({
                where,
                include: {
                    candidate: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true,
                            resumeUrl: true,
                            yearsOfExp: true,
                            currentTitle: true,
                            currentCompany: true,
                        },
                    },
                    jobPosting: {
                        select: {
                            id: true,
                            title: true,
                            department: { select: { name: true } },
                            designation: { select: { name: true } },
                        },
                    },
                },
                orderBy: [{ stage: "asc" }, { appliedAt: "desc" }],
            }),
        );

        // Group by stage for Kanban view
        const byStage: Record<string, typeof applications> = {};
        for (const app of applications) {
            if (!byStage[app.stage]) byStage[app.stage] = [];
            byStage[app.stage].push(app);
        }

        return applyRateLimitHeaders(NextResponse.json({
            data: applications,
            byStage,
            total: applications.length,
        }), rl.headers);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_APPLICATIONS_ERROR");
        return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
    }
}

const createApplicationSchema = z.object({
    candidateId: z.string().min(1),
    jobPostingId: z.string().min(1),
    coverLetter: z.string().optional(),
});

/**
 * POST /api/recruitment/applications — Create an application (HR creates on behalf of candidate)
 */
export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    // Per-user rate limit (write op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.write, ctx.userId);
    if (!rl.allowed) return rl.response!;

    try {
        const body = await req.json();
        const validation = createApplicationSchema.safeParse(body);

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

        const { candidateId, jobPostingId, coverLetter } = validation.data;

        // Verify candidate + job belong to org
        const [candidate, job] = await ctx.withDB((db) =>
            Promise.all([
                db.candidate.findFirst({
                    where: { id: candidateId, organizationId: ctx.organizationId },
                }),
                db.jobPosting.findFirst({
                    where: { id: jobPostingId, organizationId: ctx.organizationId },
                }),
            ]),
        );

        if (!candidate) {
            return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
        }
        if (!job) {
            return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
        }

        // Check for duplicate application
        const existing = await ctx.withDB((db) =>
            db.application.findUnique({
                where: {
                    candidateId_jobPostingId: { candidateId, jobPostingId },
                },
            }),
        );
        if (existing) {
            return NextResponse.json(
                { error: "This candidate has already applied for this job", code: "DUPLICATE" },
                { status: 409 },
            );
        }

        if (job.status === "closed") {
            return NextResponse.json(
                { error: "This job posting is closed", code: "JOB_CLOSED" },
                { status: 400 },
            );
        }

        const application = await ctx.withDB((db) =>
            db.application.create({
                data: {
                    candidateId,
                    jobPostingId,
                    coverLetter: coverLetter || null,
                    organizationId: ctx.organizationId,
                },
                include: {
                    candidate: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    jobPosting: { select: { id: true, title: true } },
                },
            }),
        );

        return NextResponse.json(application, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_APPLICATION_ERROR");
        return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
    }
}
