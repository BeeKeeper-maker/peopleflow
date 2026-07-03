import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";
import * as z from "zod";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;

        const application = await prisma.application.findFirst({
            where: { id, organizationId: ctx.organizationId },
            include: {
                candidate: true,
                jobPosting: {
                    include: {
                        department: { select: { name: true } },
                        designation: { select: { name: true } },
                    },
                },
            },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        return NextResponse.json(application);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_APPLICATION_ERROR");
        return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 });
    }
}

const STAGE_ORDER = ["applied", "screening", "interview", "technical", "hr", "offer", "hired"] as const;
const VALID_STAGES = [...STAGE_ORDER, "rejected"] as const;
const VALID_STATUSES = ["pending", "in_progress", "passed", "failed", "withdrawn"] as const;

const updateApplicationSchema = z.object({
    stage: z.enum(VALID_STAGES).optional(),
    status: z.enum(VALID_STATUSES).optional(),
    rating: z.number().min(1).max(5).nullable().optional(),
    feedback: z.string().max(2000).nullable().optional(),
    interviewDate: z.string().datetime().nullable().or(z.literal("")).optional(),
    interviewNotes: z.string().max(2000).nullable().optional(),
    offerSalary: z.number().min(0).nullable().optional(),
    offerDate: z.string().datetime().nullable().or(z.literal("")).optional(),
    joinDate: z.string().datetime().nullable().or(z.literal("")).optional(),
    rejectionReason: z.string().max(500).nullable().optional(),
});

/**
 * PATCH /api/recruitment/applications/[id] — Update application stage/status/feedback
 *
 * This is the main pipeline transition endpoint. HR moves candidates
 * through stages: applied → screening → interview → technical → hr → offer → hired
 * Or reject at any stage.
 *
 * When stage = "hired", an option `onboardEmployee: true` can be passed
 * to automatically create an Employee record from the candidate.
 *
 * Authorization: admin / hr_admin
 */
export async function PATCH(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const body = await req.json();
        const validation = updateApplicationSchema.safeParse(body);

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

        const application = await prisma.application.findFirst({
            where: { id, organizationId: ctx.organizationId },
            include: { candidate: true, jobPosting: true },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        const oldStage = application.stage;
        const oldStatus = application.status;

        // Parse optional date fields
        const interviewDate = data.interviewDate ? new Date(data.interviewDate) : data.interviewDate === "" ? null : undefined;
        const offerDate = data.offerDate ? new Date(data.offerDate) : data.offerDate === "" ? null : undefined;
        const joinDate = data.joinDate ? new Date(data.joinDate) : data.joinDate === "" ? null : undefined;

        const updated = await prisma.application.update({
            where: { id },
            data: {
                ...(data.stage !== undefined && { stage: data.stage }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.rating !== undefined && { rating: data.rating }),
                ...(data.feedback !== undefined && { feedback: data.feedback }),
                ...(interviewDate !== undefined && { interviewDate }),
                ...(data.interviewNotes !== undefined && { interviewNotes: data.interviewNotes }),
                ...(data.offerSalary !== undefined && { offerSalary: data.offerSalary }),
                ...(offerDate !== undefined && { offerDate }),
                ...(joinDate !== undefined && { joinDate }),
                ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason }),
            },
        });

        // Audit log for stage transitions
        if (data.stage && data.stage !== oldStage) {
            await createAuditLog({
                organizationId: ctx.organizationId,
                action: "update",
                entityType: "Application",
                entityId: id,
                oldValues: { stage: oldStage, status: oldStatus },
                newValues: { stage: data.stage, status: data.status },
                userId: ctx.userId,
                ipAddress: req.headers.get("x-forwarded-for") || undefined,
                userAgent: req.headers.get("user-agent") || undefined,
            }).catch((err) => apiLogger.error({ err }, "Audit log failed for application stage change"));
        }

        // Auto-onboard: if stage=hired and onboardEmployee=true, create Employee
        if (data.stage === "hired" && body.onboardEmployee === true) {
            const candidate = application.candidate;
            const job = application.jobPosting;

            // Check if employee already exists with this email
            const existingEmp = await prisma.employee.findFirst({
                where: { email: candidate.email, organizationId: ctx.organizationId },
            });

            if (existingEmp) {
                return NextResponse.json({
                    success: true,
                    application: updated,
                    warning: `An employee with email ${candidate.email} already exists. Application marked as hired but no new employee created.`,
                });
            }

            // Generate employee code
            const empCount = await prisma.employee.count({
                where: { organizationId: ctx.organizationId },
            });
            const employeeCode = `EMP${String(empCount + 1).padStart(4, "0")}`;

            // Create employee from candidate
            const newEmployee = await prisma.employee.create({
                data: {
                    employeeCode,
                    firstName: candidate.firstName,
                    lastName: candidate.lastName,
                    email: candidate.email,
                    phone: candidate.phone,
                    joiningDate: joinDate ? new Date(joinDate) : new Date(),
                    employmentType: job.employmentType === "internship" ? "intern" : "permanent",
                    employmentStatus: "active",
                    organizationId: ctx.organizationId,
                    designationId: job.designationId,
                    departmentId: job.departmentId,
                },
            });

            await createAuditLog({
                organizationId: ctx.organizationId,
                action: "create",
                entityType: "Employee",
                entityId: newEmployee.id,
                newValues: {
                    employeeCode,
                    name: `${candidate.firstName} ${candidate.lastName}`,
                    source: "recruitment_onboarding",
                    applicationId: id,
                },
                userId: ctx.userId,
            }).catch((err) => apiLogger.error({ err }, "Audit log failed for onboard"));

            return NextResponse.json({
                success: true,
                application: updated,
                onboardedEmployee: newEmployee,
                message: `Candidate onboarded as employee ${employeeCode}.`,
            });
        }

        return NextResponse.json({
            success: true,
            application: updated,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_APPLICATION_ERROR");
        return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
    }
}
