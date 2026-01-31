import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - List all job postings
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { organization: true },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 404 });
        }

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

        return NextResponse.json(jobs);
    } catch (error) {
        console.error("GET_JOBS_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST - Create a new job posting
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
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
        if (!["admin", "hr_admin", "superadmin"].includes(user.role)) {
            return new NextResponse("Permission denied", { status: 403 });
        }

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
        console.error("CREATE_JOB_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
