import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, applyRateLimitHeaders } from "@/lib/rate-limit";

/**
 * GET /api/public/careers/[orgSlug]/jobs — Public job board for an org
 *
 * No auth required — this is the public career page API.
 * Returns only OPEN, non-expired job postings for the org.
 *
 * P17-BUGS-14: Excludes jobs whose `closesAt` is in the past. Previously
 * the filter only checked `status: "open"`, so expired-but-still-open
 * jobs remained listed indefinitely.
 *
 * P17-BUGS-16: Added IP-based rate limiting (30 req/min) and pagination
 * (`?page=1&limit=10`, max 50) to protect the public endpoint from
 * scraping/abuse and to keep response payloads bounded.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orgSlug: string }> }) {
    // P17-BUGS-16a: rate limit unauthenticated public traffic by IP.
    const rl = await rateLimit(req, { windowMs: 60_000, maxRequests: 30 }, "careers/jobs");
    if (!rl.allowed) return rl.response!;

    try {
        const { orgSlug } = await params;
        const url = new URL(req.url);

        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
            select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                industry: true,
                countryCode: true,
            },
        });

        if (!org) {
            return NextResponse.json({ error: "Company not found" }, { status: 404 });
        }

        // P17-BUGS-14: hide expired jobs. `closesAt: null` means the job
        // has no expiry; otherwise the close time must be in the future.
        // P17-BUGS-16b: pagination params. Defaults: page=1, limit=10.
        // `limit` is clamped to [1, 50] to bound payload size.
        const now = new Date();
        const where = {
            organizationId: org.id,
            status: "open",
            OR: [{ closesAt: null }, { closesAt: { gte: now } }],
        };

        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10) || 10));
        const skip = (page - 1) * limit;

        const [jobs, total] = await Promise.all([
            prisma.jobPosting.findMany({
                where,
                include: {
                    department: { select: { name: true } },
                    designation: { select: { name: true } },
                },
                orderBy: { postedAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.jobPosting.count({ where }),
        ]);

        const response = NextResponse.json({
            company: org,
            data: jobs.map((j) => ({
                id: j.id,
                title: j.title,
                description: j.description,
                employmentType: j.employmentType,
                experience: j.experience,
                location: j.location,
                isRemote: j.isRemote,
                salaryMin: j.showSalary ? j.salaryMin : null,
                salaryMax: j.showSalary ? j.salaryMax : null,
                currency: j.currency,
                showSalary: j.showSalary,
                openings: j.openings,
                postedAt: j.postedAt,
                closesAt: j.closesAt,
                department: j.department?.name,
                designation: j.designation?.name,
            })),
            // Keep `jobs` as a backwards-compat alias for clients that
            // still read it; new clients should prefer `data`.
            jobs: jobs.map((j) => ({
                id: j.id,
                title: j.title,
                description: j.description,
                employmentType: j.employmentType,
                experience: j.experience,
                location: j.location,
                isRemote: j.isRemote,
                salaryMin: j.showSalary ? j.salaryMin : null,
                salaryMax: j.showSalary ? j.salaryMax : null,
                currency: j.currency,
                showSalary: j.showSalary,
                openings: j.openings,
                postedAt: j.postedAt,
                closesAt: j.closesAt,
                department: j.department?.name,
                designation: j.designation?.name,
            })),
            total,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });

        // P17-BUGS-16a: forward X-RateLimit-* headers on success responses
        // so well-behaved clients can back off before hitting the 429 wall.
        applyRateLimitHeaders(response, rl.headers);
        return response;
    } catch {
        return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }
}
