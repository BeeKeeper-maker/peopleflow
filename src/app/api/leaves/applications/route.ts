import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { format } from "date-fns";
import {
    calculateWorkingDays,
    checkOverlappingLeaves,
    checkMinServiceEligibility,
    checkGenderEligibility,
    createLeaveNotification,
    getWeekendDays,
    fetchHolidays,
} from "@/lib/leave-utils";
import { validateMaternityLeave } from "@/lib/leave-compliance-engine";
import { createApprovalRequest } from "@/lib/approval-engine";
import { leaveLogger } from "@/lib/logger";

type OverlappingLeaveSummary = {
    leaveType: { name: string };
    fromDate: Date | string;
    toDate: Date | string;
};

function leaveError(message: string, status = 400, details?: Record<string, unknown>) {
    return NextResponse.json({ error: message, ...details }, { status });
}

export async function GET(req: Request) {
    // Authenticate first
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) {
        return auth; // Returns 401 Unauthorized
    }

    try {
        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get("employeeId");
        const status = searchParams.get("status");
        const year = searchParams.get("year");
        const month = searchParams.get("month");
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
        const skip = (page - 1) * limit;

        // Get user details for role check
        const user = await auth.withDB((db) => db.user.findUnique({
            where: { id: auth.userId },
            include: { employee: true },
        }));

        const where: Record<string, unknown> = {
            employee: {
                organizationId: auth.organizationId,
            },
        };

        // If filtering by employee
        if (employeeId) {
            if (user?.role === "manager") {
                const reportee = await auth.withDB((db) => db.employee.findFirst({
                    where: {
                        id: employeeId,
                        organizationId: auth.organizationId,
                        reportingManagerId: user.employee?.id,
                    },
                    select: { id: true },
                }));
                if (!reportee) return leaveError("Employee not found", 404);
            }
            where.employeeId = employeeId;
        }
        // Managers should only see their direct reportees' leaves
        else if (user?.role === "manager" && user.employee) {
            where.employee = {
                organizationId: auth.organizationId,
                reportingManagerId: user.employee.id,
            };
        }
        // If regular employee (not admin/hr), only see own leaves
        // EXCEPTION: If viewing approved leaves (Calendar View), allow seeing all
        else if (user?.role === "employee" && user.employee && status !== "approved") {
            where.employeeId = user.employee.id;
        }

        if (status) {
            where.status = status;
        }

        if (year && month) {
            const y = Number(year);
            const m = Number(month);
            if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
                const start = new Date(Date.UTC(y, m - 1, 1));
                const end = new Date(Date.UTC(y, m, 1));
                where.OR = [
                    { fromDate: { gte: start, lt: end } },
                    { toDate: { gte: start, lt: end } },
                    { AND: [{ fromDate: { lt: start } }, { toDate: { gte: end } }] },
                ];
            }
        }

        const [applications, total] = await auth.withDB((db) =>
            Promise.all([
                db.leaveApplication.findMany({
                    where,
                    include: {
                        leaveType: true,
                        employee: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                photoUrl: true,
                                reportingManagerId: true,
                                reportingManager: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        employeeCode: true,
                                    }
                                },
                                designation: {
                                    select: { name: true }
                                }
                            }
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                }),
                db.leaveApplication.count({ where }),
            ]),
        );

        const approvalRequests = await auth.withDB((db) => db.approvalRequest.findMany({
            where: {
                organizationId: auth.organizationId,
                entityType: "leave",
                entityId: { in: applications.map((application) => application.id) },
            },
            include: {
                steps: { orderBy: { stepNumber: "asc" } },
            },
        }));

        const approvalEmployeeIds = new Set<string>();
        approvalRequests.forEach((request) => {
            if (request.currentApproverId) approvalEmployeeIds.add(request.currentApproverId);
            request.steps.forEach((step) => {
                if (step.assignedToId) approvalEmployeeIds.add(step.assignedToId);
                if (step.actedById) approvalEmployeeIds.add(step.actedById);
            });
        });

        const approvalEmployees = approvalEmployeeIds.size
            ? await auth.withDB((db) => db.employee.findMany({
                where: {
                    organizationId: auth.organizationId,
                    id: { in: Array.from(approvalEmployeeIds) },
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                    user: { select: { role: true, isActive: true } },
                },
            }))
            : [];

        const employeeById = new Map(approvalEmployees.map((employee) => [employee.id, employee]));
        const requestByEntityId = new Map(approvalRequests.map((request) => [request.entityId, request]));

        const data = applications.map((application) => {
            const approvalRequest = requestByEntityId.get(application.id);
            const currentApprover = approvalRequest?.currentApproverId
                ? employeeById.get(approvalRequest.currentApproverId) || null
                : null;
            const warnings: string[] = [];

            if (approvalRequest?.status === "in_progress" && !currentApprover) {
                warnings.push("Current approver is not resolved. Check reporting manager or role assignment.");
            }
            if (approvalRequest?.currentApproverRole === "manager" && !application.employee.reportingManagerId) {
                warnings.push("Employee has no reporting manager; manager approval may be blocked.");
            }

            return {
                ...application,
                approvalTrail: approvalRequest ? {
                    id: approvalRequest.id,
                    status: approvalRequest.status,
                    currentStep: approvalRequest.currentStep,
                    totalSteps: approvalRequest.totalSteps,
                    currentApproverRole: approvalRequest.currentApproverRole,
                    currentApprover: currentApprover ? {
                        id: currentApprover.id,
                        firstName: currentApprover.firstName,
                        lastName: currentApprover.lastName,
                        employeeCode: currentApprover.employeeCode,
                        role: currentApprover.user?.role || null,
                        isActive: currentApprover.user?.isActive ?? null,
                    } : null,
                    steps: approvalRequest.steps.map((step) => {
                        const assignedTo = step.assignedToId ? employeeById.get(step.assignedToId) : null;
                        const actedBy = step.actedById ? employeeById.get(step.actedById) : null;
                        return {
                            stepNumber: step.stepNumber,
                            stepName: step.stepName,
                            assignedRole: step.assignedRole,
                            status: step.status,
                            assignedTo: assignedTo ? {
                                id: assignedTo.id,
                                firstName: assignedTo.firstName,
                                lastName: assignedTo.lastName,
                                employeeCode: assignedTo.employeeCode,
                            } : null,
                            actedBy: actedBy ? {
                                id: actedBy.id,
                                firstName: actedBy.firstName,
                                lastName: actedBy.lastName,
                                employeeCode: actedBy.employeeCode,
                            } : null,
                            actedAt: step.actedAt,
                            notes: step.notes,
                        };
                    }),
                    warnings,
                } : null,
            };
        });

        return NextResponse.json({
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        leaveLogger.error({ err: error }, "GET_LEAVE_APPLICATIONS_ERROR");
        return leaveError("Internal Error", 500);
    }
}

export async function POST(req: Request) {
    // Authenticate first
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) {
        return auth; // Returns 401 Unauthorized
    }

    try {
        // Get employee profile with organization settings
        const user = await auth.withDB((db) => db.user.findUnique({
            where: { id: auth.userId },
            include: {
                employee: {
                    include: {
                        organization: {
                            select: { settings: true },
                        },
                    },
                },
            },
        }));

        let employee = user?.employee;
        if (!employee && user?.email) {
            employee = await auth.withDB((db) => db.employee.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    email: user.email,
                    deletedAt: null,
                },
                include: {
                    organization: {
                        select: { settings: true },
                    },
                },
            }));
        }

        if (!employee) {
            return leaveError(
                "No employee profile is linked to this account. Please open an employee/ESS account or link this admin user to an employee before applying for leave.",
                400,
                { code: "EMPLOYEE_PROFILE_REQUIRED" }
            );
        }

        if (employee.employmentStatus !== "active" || employee.deletedAt) {
            return leaveError("Inactive employees cannot apply for leave", 403);
        }

        const json = await req.json();
        const {
            leaveTypeId, fromDate, toDate, halfDay, halfDayType, reason, documents,
            // ✅ NEW: Maternity leave fields
            expectedDeliveryDate, maternityPhase,
        } = json;

        const start = new Date(fromDate);
        const end = new Date(toDate);

        if (!leaveTypeId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return leaveError("Leave type, start date, and end date are required", 400);
        }

        if (halfDay && format(start, "yyyy-MM-dd") !== format(end, "yyyy-MM-dd")) {
            return leaveError("Half-day leave must start and end on the same date", 400);
        }

        // ── Validation 1: Basic date validation ──
        if (end < start) {
            return leaveError("End date cannot be before start date", 400);
        }

        // ── Validation 2: Fetch Leave Type ──
        const leaveType = await auth.withDB((db) => db.leaveType.findFirst({
            where: {
                id: leaveTypeId,
                organizationId: auth.organizationId,
            },
        }));

        if (!leaveType) {
            return leaveError("Leave type not found", 404);
        }

        // ── Validation 3: Gender eligibility check ──
        if (!checkGenderEligibility(employee.gender, leaveType.applicableGender)) {
            return leaveError(`This leave type (${leaveType.name}) is only available for ${leaveType.applicableGender} employees`, 403);
        }

        // ── Validation 4: Minimum service days check ──
        const serviceCheck = checkMinServiceEligibility(
            employee.joiningDate,
            leaveType.minServiceDays
        );
        if (!serviceCheck.eligible) {
            return leaveError(
                `You need at least ${serviceCheck.required} days of service to apply for ${leaveType.name}. ` +
                `Your current service: ${serviceCheck.serviceDays} days.`,
                403
            );
        }

        // ── Validation 5: Overlapping leave check ──
        const overlappingLeaves = await checkOverlappingLeaves(
            prisma,
            employee.id,
            start,
            end
        );
        if (overlappingLeaves.length > 0) {
            const conflictInfo = overlappingLeaves
                .map((l: OverlappingLeaveSummary) =>
                    `${l.leaveType.name} (${format(new Date(l.fromDate), "dd MMM")} - ${format(new Date(l.toDate), "dd MMM")})`
                )
                .join(", ");
            return leaveError(`You already have overlapping leave(s): ${conflictInfo}`, 409);
        }

        // ── ✅ NEW: Maternity Leave Validation (BLA 2006, Section 46-47) ──
        const isMaternityLeave = leaveType.code === "ML" || leaveType.name.toLowerCase().includes("maternity");
        let maternityData: Record<string, unknown> = {};

        if (isMaternityLeave && expectedDeliveryDate) {
            const maternityValidation = await validateMaternityLeave({
                employeeId: employee.id,
                fromDate: start,
                toDate: end,
                expectedDeliveryDate: new Date(expectedDeliveryDate),
                maternityPhase: maternityPhase || "full",
            });

            if (!maternityValidation.isValid) {
                return NextResponse.json(
                    {
                        error: "Maternity leave validation failed",
                        violations: maternityValidation.errors,
                        warnings: maternityValidation.warnings,
                    },
                    { status: 400 }
                );
            }

            // Set maternity-specific fields
            maternityData = {
                isMaternityLeave: true,
                maternityPhase: maternityPhase || "full",
                expectedDeliveryDate: new Date(expectedDeliveryDate),
                preDeliveryDays: maternityValidation.calculation?.preDeliveryDays || 0,
                postDeliveryDays: maternityValidation.calculation?.postDeliveryDays || 0,
            };
        }

        // ── Calculate working days (excluding weekends + holidays) ──
        let totalDays: number;
        if (halfDay) {
            totalDays = 0.5;
        } else {
            // Get organization weekend configuration
            const weekendDays = getWeekendDays(employee.organization?.settings);

            // Get holidays for the leave period year(s)
            const leaveYear = start.getFullYear();
            const holidays = await fetchHolidays(prisma, auth.organizationId, leaveYear);

            // If leave spans across years, also fetch next year's holidays
            if (end.getFullYear() !== leaveYear) {
                const nextYearHolidays = await fetchHolidays(
                    prisma,
                    auth.organizationId,
                    end.getFullYear()
                );
                holidays.push(...nextYearHolidays);
            }

            totalDays = calculateWorkingDays(start, end, holidays, weekendDays);

            if (totalDays <= 0) {
                return leaveError("The selected dates contain no working days (all weekends/holidays)", 400);
            }
        }

        // ── Check or Create Allocation ──
        const currentYear = new Date().getFullYear();
        let allocation = await auth.withDB((db) => db.leaveAllocation.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId: employee.id,
                    leaveTypeId: leaveTypeId,
                    year: currentYear,
                },
            },
        }));

        if (!allocation) {
            // Lazy initialization of allocation
            allocation = await auth.withDB((db) => db.leaveAllocation.create({
                data: {
                    employeeId: employee.id,
                    organizationId: auth.organizationId,
                    leaveTypeId: leaveTypeId,
                    year: currentYear,
                    allocatedDays: leaveType.annualAllocation,
                    usedDays: 0,
                    carriedForward: 0,
                },
            }));
        }

        // ── Check Balance ──
        const remainingDays = allocation.allocatedDays + allocation.carriedForward - allocation.usedDays;
        if (totalDays > remainingDays) {
            return leaveError(`Insufficient leave balance. Requested: ${totalDays} working days, Remaining: ${remainingDays} days`, 400);
        }

        // ── Create Application (with maternity data if applicable) ──
        const application = await auth.withDB((db) => db.leaveApplication.create({
            data: {
                employeeId: employee.id,
                organizationId: auth.organizationId,
                leaveTypeId,
                fromDate: start,
                toDate: end,
                totalDays,
                halfDay,
                halfDayType,
                reason,
                documents: documents || undefined,
                status: "pending",
                ...maternityData,
            },
            include: {
                leaveType: true,
                employee: {
                    select: { firstName: true, lastName: true },
                },
            },
        }));

        // ── ✅ NEW: Create Stateful Approval Request ──
        // CRITICAL: If approval request creation fails, we MUST roll back the leave
        // application. Otherwise the leave exists in "pending" status but can never
        // be approved — the employee's leave balance is consumed forever.
        try {
            await createApprovalRequest({
                entityType: "leave",
                entityId: application.id,
                requestTitle: `${application.leaveType.name}: ${totalDays} day(s) (${format(start, "dd MMM")} - ${format(end, "dd MMM")})`,
                requesterId: employee.id,
                organizationId: auth.organizationId,
                priority: isMaternityLeave ? "high" : "normal",
            });
        } catch (approvalError) {
            leaveLogger.error({ err: approvalError }, "APPROVAL_REQUEST_CREATION_ERROR");

            // Roll back: delete the leave application so balance is not consumed
            try {
                await prisma.leaveApplication.delete({ where: { id: application.id } });
                leaveLogger.info({ leaveApplicationId: application.id }, "Rolled back leave application after approval request failure");
            } catch (rollbackError) {
                leaveLogger.error({ err: rollbackError, leaveApplicationId: application.id }, "FAILED_TO_ROLLBACK_LEAVE_APPLICATION");
            }

            return NextResponse.json(
                { error: "Failed to create approval workflow. Leave application not submitted. Please try again or contact HR." },
                { status: 500 }
            );
        }

        // ── Notify admin/HR users about new leave request ──
        const notificationData = {
            applicantName: `${application.employee.firstName} ${application.employee.lastName}`,
            leaveTypeName: application.leaveType.name,
            fromDate: format(start, "dd MMM yyyy"),
            toDate: format(end, "dd MMM yyyy"),
            totalDays,
            reason: reason || undefined,
        };

        // Find admin/HR users in the same organization to notify
        const adminUsers = await prisma.user.findMany({
            where: {
                organizationId: auth.organizationId,
                role: { in: ["admin", "hr_admin", "manager"] },
                id: { not: auth.userId }, // Don't notify yourself
            },
            select: { id: true },
        });

        // Send notifications in parallel (fire & forget, errors handled inside)
        await Promise.allSettled(
            adminUsers.map((admin: { id: string }) =>
                createLeaveNotification(
                    prisma,
                    "leave_applied",
                    admin.id,
                    notificationData,
                    application.id
                )
            )
        );

        return NextResponse.json(application);
    } catch (error) {
        leaveLogger.error({ err: error }, "CREATE_LEAVE_APPLICATION_ERROR");
        return leaveError("Internal Error", 500);
    }
}
