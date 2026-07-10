import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";
import { rateLimit, applyRateLimitHeaders } from "@/lib/rate-limit";
import * as z from "zod";

/**
 * GET /api/public/careers/[orgSlug]/jobs/[jobId] — Public job detail
 *
 * P17-BUGS-14: Now also excludes expired jobs (closesAt < now) so a stale
 * link to a closed position returns 404 instead of the job detail.
 *
 * P17-BUGS-16a: IP-based rate limited (30 req/min) like the listing route.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ orgSlug: string; jobId: string }> },
) {
    // P17-BUGS-16a: rate limit unauthenticated public traffic by IP.
    const rl = await rateLimit(req, { windowMs: 60_000, maxRequests: 30 }, "careers/job-detail");
    if (!rl.allowed) return rl.response!;

    try {
        const { orgSlug, jobId } = await params;

        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
            select: { id: true, name: true, slug: true, logoUrl: true },
        });

        if (!org) {
            return NextResponse.json({ error: "Company not found" }, { status: 404 });
        }

        // P17-BUGS-14: hide expired jobs — `closesAt` must be null or in the future.
        const now = new Date();
        const job = await prisma.jobPosting.findFirst({
            where: {
                id: jobId,
                organizationId: org.id,
                status: "open",
                OR: [{ closesAt: null }, { closesAt: { gte: now } }],
            },
            include: {
                department: { select: { name: true } },
                designation: { select: { name: true } },
            },
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found or closed" }, { status: 404 });
        }

        const response = NextResponse.json({
            company: org,
            job,
        });
        applyRateLimitHeaders(response, rl.headers);
        return response;
    } catch {
        return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
    }
}

const applySchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    resumeUrl: z.string().optional(),
    coverLetter: z.string().optional(),
    portfolioUrl: z.string().url().optional().or(z.literal("")),
    linkedinUrl: z.string().url().optional().or(z.literal("")),
    yearsOfExp: z.coerce.number().min(0).optional(),
    currentCompany: z.string().optional(),
    currentTitle: z.string().optional(),
    skills: z.string().optional(),
    education: z.string().optional(),
    source: z.string().default("website"),
});

/**
 * POST /api/public/careers/[orgSlug]/jobs/[jobId] — Public apply endpoint
 *
 * No auth required — candidates apply from the public career page.
 * Creates a Candidate (or reuses existing by email) + an Application.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ orgSlug: string; jobId: string }> },
) {
    // P17-BUGS-16a: rate limit unauthenticated public traffic by IP. The
    // POST apply endpoint is more sensitive than the GETs (it writes rows
    // + sends notification emails), so it gets a tighter 10 req/min cap.
    const rl = await rateLimit(req, { windowMs: 60_000, maxRequests: 10 }, "careers/apply");
    if (!rl.allowed) return rl.response!;

    try {
        const { orgSlug, jobId } = await params;

        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
            select: { id: true },
        });

        if (!org) {
            return NextResponse.json({ error: "Company not found" }, { status: 404 });
        }

        // P17-BUGS-14: also reject applications to expired jobs, even if the
        // job's status hasn't been flipped to "closed" yet.
        const now = new Date();
        const job = await prisma.jobPosting.findFirst({
            where: {
                id: jobId,
                organizationId: org.id,
                status: "open",
                OR: [{ closesAt: null }, { closesAt: { gte: now } }],
            },
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found or closed" }, { status: 404 });
        }

        // P17-BUGS-15: wrap JSON parsing so an invalid body returns 400
        // instead of crashing the route with a 500.
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body" },
                { status: 400 },
            );
        }
        const validation = applySchema.safeParse(body);

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

        const data = validation.data;

        // P17-BUGS-13: Check for a duplicate application BEFORE mutating the
        // candidate row. Previously the flow updated the existing candidate's
        // resumeUrl/portfolioUrl/etc. first and only then checked for an
        // existing application — which meant an attacker could submit a
        // bogus application using a victim's email and a fake resume URL,
        // overwriting the victim's real resume even though the application
        // was ultimately rejected with 409. The duplicate check now runs
        // first; if a candidate with this email has already applied to this
        // job, we short-circuit with 409 and touch nothing.
        const existingCandidate = await prisma.candidate.findFirst({
            where: { email: data.email, organizationId: org.id },
            select: { id: true },
        });

        if (existingCandidate) {
            const existingApp = await prisma.application.findUnique({
                where: {
                    candidateId_jobPostingId: {
                        candidateId: existingCandidate.id,
                        jobPostingId: jobId,
                    },
                },
                select: { id: true },
            });

            if (existingApp) {
                return NextResponse.json(
                    {
                        error: "You have already applied for this position.",
                        code: "ALREADY_APPLIED",
                    },
                    { status: 409 },
                );
            }
        }

        // Reuse existing candidate by email, or create new
        let candidate = existingCandidate
            ? await prisma.candidate.findUnique({
                  where: { id: existingCandidate.id },
              })
            : null;

        if (!candidate) {
            candidate = await prisma.candidate.create({
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    phone: data.phone,
                    resumeUrl: data.resumeUrl || null,
                    portfolioUrl: data.portfolioUrl || null,
                    linkedinUrl: data.linkedinUrl || null,
                    yearsOfExp: data.yearsOfExp,
                    currentCompany: data.currentCompany,
                    currentTitle: data.currentTitle,
                    skills: data.skills,
                    education: data.education,
                    source: data.source,
                    organizationId: org.id,
                },
            });
        } else {
            // Update existing candidate with new info (resume may have changed)
            await prisma.candidate.update({
                where: { id: candidate.id },
                data: {
                    ...(data.resumeUrl && { resumeUrl: data.resumeUrl }),
                    ...(data.portfolioUrl && { portfolioUrl: data.portfolioUrl }),
                    ...(data.linkedinUrl && { linkedinUrl: data.linkedinUrl }),
                    ...(data.yearsOfExp !== undefined && { yearsOfExp: data.yearsOfExp }),
                    ...(data.currentCompany && { currentCompany: data.currentCompany }),
                    ...(data.currentTitle && { currentTitle: data.currentTitle }),
                    ...(data.skills && { skills: data.skills }),
                    ...(data.education && { education: data.education }),
                },
            });
        }

        // Create the application (duplicate check already done above)
        const application = await prisma.application.create({
            data: {
                candidateId: candidate.id,
                jobPostingId: jobId,
                coverLetter: data.coverLetter || null,
                organizationId: org.id,
            },
        });

        apiLogger.info(
            { applicationId: application.id, jobId, candidateId: candidate.id, orgId: org.id },
            "Public job application received",
        );

        return NextResponse.json(
            {
                success: true,
                applicationId: application.id,
                message: "Application submitted successfully. We'll contact you soon.",
            },
            { status: 201 },
        );
    } catch (error) {
        apiLogger.error({ err: error }, "PUBLIC_APPLY_ERROR");
        return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
    }
}
