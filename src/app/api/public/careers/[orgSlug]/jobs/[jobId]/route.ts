import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

/**
 * GET /api/public/careers/[orgSlug]/jobs/[jobId] — Public job detail
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ orgSlug: string; jobId: string }> },
) {
    try {
        const { orgSlug, jobId } = await params;

        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
            select: { id: true, name: true, slug: true, logoUrl: true },
        });

        if (!org) {
            return NextResponse.json({ error: "Company not found" }, { status: 404 });
        }

        const job = await prisma.jobPosting.findFirst({
            where: {
                id: jobId,
                organizationId: org.id,
                status: "open",
            },
            include: {
                department: { select: { name: true } },
                designation: { select: { name: true } },
            },
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found or closed" }, { status: 404 });
        }

        return NextResponse.json({
            company: org,
            job,
        });
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
    try {
        const { orgSlug, jobId } = await params;

        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
            select: { id: true },
        });

        if (!org) {
            return NextResponse.json({ error: "Company not found" }, { status: 404 });
        }

        const job = await prisma.jobPosting.findFirst({
            where: { id: jobId, organizationId: org.id, status: "open" },
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found or closed" }, { status: 404 });
        }

        const body = await req.json();
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

        // Reuse existing candidate by email, or create new
        let candidate = await prisma.candidate.findFirst({
            where: { email: data.email, organizationId: org.id },
        });

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

        // Check for duplicate application
        const existingApp = await prisma.application.findUnique({
            where: {
                candidateId_jobPostingId: {
                    candidateId: candidate.id,
                    jobPostingId: jobId,
                },
            },
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

        // Create the application
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
