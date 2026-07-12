import { NextResponse } from "next/server";
import { withTenant, withPlatform } from "@/lib/prisma";
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

        const sessionEmail = session.user.email;

        const user = await withPlatform((db) =>
            db.user.findUnique({
                where: { email: sessionEmail },
            }),
        );

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 404 });
        }

        const orgId = user.organizationId;

        const job = await withTenant(orgId, (db) =>
            db.jobPosting.findFirst({
                where: { id, organizationId: orgId },
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
            }),
        );

        if (!job) {
            return new NextResponse("Job not found", { status: 404 });
        }

        return NextResponse.json(job);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "GET_JOB_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
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

        const sessionEmail = session.user.email;

        const user = await withPlatform((db) =>
            db.user.findUnique({
                where: { email: sessionEmail },
            }),
        );

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 404 });
        }

        const orgId = user.organizationId;

        if (!["admin", "hr_admin", "super_admin"].includes(user.role)) {
            return new NextResponse("Permission denied", { status: 403 });
        }

        const existingJob = await withTenant(orgId, (db) =>
            db.jobPosting.findFirst({
                where: { id, organizationId: orgId },
            }),
        );

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

        const job = await withTenant(orgId, (db) =>
            db.jobPosting.update({
                where: { id },
                data: updateData,
                include: {
                    department: { select: { id: true, name: true } },
                    designation: { select: { id: true, name: true } },
                },
            }),
        );

        return NextResponse.json(job);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "UPDATE_JOB_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
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

        const sessionEmail = session.user.email;

        const user = await withPlatform((db) =>
            db.user.findUnique({
                where: { email: sessionEmail },
            }),
        );

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 404 });
        }

        const orgId = user.organizationId;

        if (!["admin", "hr_admin", "super_admin"].includes(user.role)) {
            return new NextResponse("Permission denied", { status: 403 });
        }

        const existingJob = await withTenant(orgId, (db) =>
            db.jobPosting.findFirst({
                where: { id, organizationId: orgId },
            }),
        );

        if (!existingJob) {
            return new NextResponse("Job not found", { status: 404 });
        }

        await withTenant(orgId, (db) =>
            db.jobPosting.delete({ where: { id } }),
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "DELETE_JOB_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
