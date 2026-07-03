import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

/**
 * GET /api/recruitment/candidates — List candidates with filters
 *
 * Query params:
 *   - search: search by name/email/phone
 *   - source: linkedin, referral, website, job_board
 *   - limit: max 100 (default 50)
 */
export async function GET(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search");
        const source = searchParams.get("source");
        const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));

        const where: Record<string, unknown> = {
            organizationId: ctx.organizationId,
        };

        if (source) where.source = source;

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                { currentCompany: { contains: search, mode: "insensitive" } },
            ];
        }

        const candidates = await prisma.candidate.findMany({
            where,
            include: {
                applications: {
                    include: {
                        jobPosting: {
                            select: { id: true, title: true, department: { select: { name: true } } },
                        },
                    },
                    orderBy: { appliedAt: "desc" },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return NextResponse.json({ data: candidates, total: candidates.length });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_CANDIDATES_ERROR");
        return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
    }
}

const createCandidateSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
    resumeUrl: z.string().url().optional().or(z.literal("")),
    portfolioUrl: z.string().url().optional().or(z.literal("")),
    linkedinUrl: z.string().url().optional().or(z.literal("")),
    currentCompany: z.string().optional(),
    currentTitle: z.string().optional(),
    yearsOfExp: z.coerce.number().min(0).optional(),
    expectedSalary: z.coerce.number().min(0).optional(),
    noticePeriod: z.string().optional(),
    skills: z.string().optional(),
    education: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
});

/**
 * POST /api/recruitment/candidates — Create a candidate
 */
export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = createCandidateSchema.safeParse(body);

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

        // Check email uniqueness within org
        const existing = await prisma.candidate.findFirst({
            where: { email: data.email, organizationId: ctx.organizationId },
        });
        if (existing) {
            return NextResponse.json(
                { error: "A candidate with this email already exists", code: "EMAIL_EXISTS" },
                { status: 409 },
            );
        }

        const candidate = await prisma.candidate.create({
            data: {
                ...data,
                resumeUrl: data.resumeUrl || null,
                portfolioUrl: data.portfolioUrl || null,
                linkedinUrl: data.linkedinUrl || null,
                organizationId: ctx.organizationId,
            },
        });

        return NextResponse.json(candidate, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_CANDIDATE_ERROR");
        return NextResponse.json({ error: "Failed to create candidate" }, { status: 500 });
    }
}
