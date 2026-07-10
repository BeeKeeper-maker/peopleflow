import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { successResponse, errorResponse, createdResponse, ErrorCodes } from "@/lib/api-response";
import { apiLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS, applyRateLimitHeaders } from "@/lib/rate-limit";

// GET - List all job postings
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return errorResponse(ErrorCodes.UNAUTHORIZED, "Authentication required");
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { organization: true },
        });

        if (!user?.organizationId) {
            return errorResponse(ErrorCodes.NOT_FOUND, "Organization not found");
        }

        // Per-user rate limit (read op)
        const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, user.id);
        if (!rl.allowed) return rl.response!;

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const departmentId = searchParams.get("departmentId");

        const where: any = { organizationId: user.organizationId };
        if (status) where.status = status;
        if (departmentId) where.departmentId = departmentId;

        const jobs = await prisma.jobPosting.findMany({
            where,
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
                _count: { select: { applications: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return applyRateLimitHeaders(successResponse(jobs), rl.headers);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_JOBS_ERROR");
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch jobs");
    }
}

// POST - Create a new job posting
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 404 });
        }

        // Check if user has permission
        if (!["admin", "hr_admin", "super_admin"].includes(user.role)) {
            return new NextResponse("Permission denied", { status: 403 });
        }

        // Per-user rate limit (write op)
        const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.write, user.id);
        if (!rl.allowed) return rl.response!;

        const body = await req.json();
        const {
            title,
            description,
            requirements,
            responsibilities,
            employmentType,
            experience,
            education,
            skills,
            salaryMin,
            salaryMax,
            showSalary,
            location,
            isRemote,
            status,
            openings,
            closesAt,
            departmentId,
            designationId,
        } = body;

        if (!title || !description || !employmentType) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const job = await prisma.jobPosting.create({
            data: {
                title,
                description,
                requirements,
                responsibilities,
                employmentType,
                experience,
                education,
                skills,
                salaryMin: salaryMin || null,
                salaryMax: salaryMax || null,
                showSalary: showSalary || false,
                location,
                isRemote: isRemote || false,
                status: status || "draft",
                openings: openings || 1,
                closesAt: closesAt ? new Date(closesAt) : null,
                postedAt: status === "open" ? new Date() : null,
                departmentId: departmentId || null,
                designationId: designationId || null,
                organizationId: user.organizationId,
            },
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json(job);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "CREATE_JOB_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
