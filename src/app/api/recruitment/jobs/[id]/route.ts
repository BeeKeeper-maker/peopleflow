import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";

// GET - Get a single job posting
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        const job = await prisma.jobPosting.findFirst({
            where: { id, organizationId: user.organizationId },
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
                applications: {
                    include: {
                        candidate: true,
                    },
                    orderBy: { appliedAt: "desc" },
                },
            },
        });

        if (!job) {
            return new NextResponse("Job not found", { status: 404 });
        }

        return NextResponse.json(job);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_JOB_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// PATCH - Update a job posting
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        if (!["admin", "hr_admin", "superadmin"].includes(user.role)) {
            return new NextResponse("Permission denied", { status: 403 });
        }

        const existingJob = await prisma.jobPosting.findFirst({
            where: { id, organizationId: user.organizationId },
        });

        if (!existingJob) {
            return new NextResponse("Job not found", { status: 404 });
        }

        const body = await req.json();
        const updateData: any = {};

        // Only include fields that are provided
        const allowedFields = [
            "title", "description", "requirements", "responsibilities",
            "employmentType", "experience", "education", "skills",
            "salaryMin", "salaryMax", "showSalary", "location", "isRemote",
            "status", "openings", "closesAt", "departmentId", "designationId"
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        // Handle status change to open
        if (body.status === "open" && existingJob.status !== "open") {
            updateData.postedAt = new Date();
        }

        // Handle date fields
        if (updateData.closesAt) {
            updateData.closesAt = new Date(updateData.closesAt);
        }

        const job = await prisma.jobPosting.update({
            where: { id },
            data: updateData,
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json(job);
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_JOB_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// DELETE - Delete a job posting
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        if (!["admin", "hr_admin", "superadmin"].includes(user.role)) {
            return new NextResponse("Permission denied", { status: 403 });
        }

        const existingJob = await prisma.jobPosting.findFirst({
            where: { id, organizationId: user.organizationId },
        });

        if (!existingJob) {
            return new NextResponse("Job not found", { status: 404 });
        }

        await prisma.jobPosting.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "DELETE_JOB_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
