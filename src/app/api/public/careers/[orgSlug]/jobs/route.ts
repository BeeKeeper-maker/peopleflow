import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/careers/[orgSlug]/jobs — Public job board for an org
 *
 * No auth required — this is the public career page API.
 * Returns only OPEN job postings for the org.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orgSlug: string }> }) {
    try {
        const { orgSlug } = await params;

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

        const jobs = await prisma.jobPosting.findMany({
            where: {
                organizationId: org.id,
                status: "open",
            },
            include: {
                department: { select: { name: true } },
                designation: { select: { name: true } },
            },
            orderBy: { postedAt: "desc" },
        });

        return NextResponse.json({
            company: org,
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
            total: jobs.length,
        });
    } catch {
        return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }
}
