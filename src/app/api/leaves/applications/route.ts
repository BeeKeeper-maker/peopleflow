import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated, AuthContext } from "@/lib/api-auth";
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
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
        const skip = (page - 1) * limit;

        // Get user details for role check
        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            include: { employee: true },
        });

        const where: Record<string, unknown> = {
            employee: {
                organizationId: auth.organizationId,
            },
        };

        // If filtering by employee
        if (employeeId) {
            where.employeeId = employeeId;
        }
        // If regular employee (not admin/hr), only see own leaves
        // EXCEPTION: If viewing approved leaves (Calendar View), allow seeing all
        else if (user?.role === "employee" && user.employee && status !== "approved") {
            where.employeeId = user.employee.id;
        }

        if (status) {
            where.status = status;
        }

        const [applications, total] = await Promise.all([
            prisma.leaveApplication.findMany({
                where,
                include: {
                    leaveType: true,
                    employee: {
                        select: {
                            firstName: true,
                            lastName: true,
                            photoUrl: true,
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
            prisma.leaveApplication.count({ where }),
        ]);

        return NextResponse.json({
            data: applications,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        leaveLogger.error({ err: error }, "GET_LEAVE_APPLICATIONS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
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
        const user = await prisma.user.findUnique({
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
        });

        if (!user?.employee) {
            return new NextResponse("Employee profile not found", { status: 400 });
        }

        const json = await req.json();
        const {
            leaveTypeId, fromDate, toDate, halfDay, halfDayType, reason, documents,
            // ✅ NEW: Maternity leave fields
            expectedDeliveryDate, maternityPhase,
        } = json;

        const start = new Date(fromDate);
        const end = new Date(toDate);

        // ── Validation 1: Basic date validation ──
        if (end < start) {
            return new NextResponse("End date cannot be before start date", { status: 400 });
        }

        // ── Validation 2: Fetch Leave Type ──
        const leaveType = await prisma.leaveType.findUnique({
            where: { id: leaveTypeId },
        });

        if (!leaveType) {
            return new NextResponse("Leave type not found", { status: 404 });
        }

        // ── Validation 3: Gender eligibility check ──
        if (!checkGenderEligibility(user.employee.gender, leaveType.applicableGender)) {
            return new NextResponse(
                `This leave type (${leaveType.name}) is only available for ${leaveType.applicableGender} employees`,
                { status: 403 }
            );
        }

        // ── Validation 4: Minimum service days check ──
        const serviceCheck = checkMinServiceEligibility(
            user.employee.joiningDate,
            leaveType.minServiceDays
        );
        if (!serviceCheck.eligible) {
            return new NextResponse(
                `You need at least ${serviceCheck.required} days of service to apply for ${leaveType.name}. ` +
                `Your current service: ${serviceCheck.serviceDays} days.`,
                { status: 403 }
            );
        }

        // ── Validation 5: Overlapping leave check ──
        const overlappingLeaves = await checkOverlappingLeaves(
            prisma,
            user.employee.id,
            start,
            end
        );
        if (overlappingLeaves.length > 0) {
            const conflictInfo = overlappingLeaves
                .map((l: any) =>
                    `${l.leaveType.name} (${format(new Date(l.fromDate), "dd MMM")} - ${format(new Date(l.toDate), "dd MMM")})`
                )
                .join(", ");
            return new NextResponse(
                `You already have overlapping leave(s): ${conflictInfo}`,
                { status: 409 }
            );
        }

        // ── ✅ NEW: Maternity Leave Validation (BLA 2006, Section 46-47) ──
        const isMaternityLeave = leaveType.code === "ML" || leaveType.name.toLowerCase().includes("maternity");
        let maternityData: Record<string, unknown> = {};

        if (isMaternityLeave && expectedDeliveryDate) {
            const maternityValidation = await validateMaternityLeave({
                employeeId: user.employee.id,
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
            const weekendDays = getWeekendDays(user.employee.organization?.settings);

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
                return new NextResponse(
                    "The selected dates contain no working days (all weekends/holidays)",
                    { status: 400 }
                );
            }
        }

        // ── Check or Create Allocation ──
        const currentYear = new Date().getFullYear();
        let allocation = await prisma.leaveAllocation.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId: user.employee.id,
                    leaveTypeId: leaveTypeId,
                    year: currentYear,
                },
            },
        });

        if (!allocation) {
            // Lazy initialization of allocation
            allocation = await prisma.leaveAllocation.create({
                data: {
                    employeeId: user.employee.id,
                    leaveTypeId: leaveTypeId,
                    year: currentYear,
                    allocatedDays: leaveType.annualAllocation,
                    usedDays: 0,
                    carriedForward: 0,
                },
            });
        }

        // ── Check Balance ──
        const remainingDays = allocation.allocatedDays + allocation.carriedForward - allocation.usedDays;
        if (totalDays > remainingDays) {
            return new NextResponse(
                `Insufficient leave balance. Requested: ${totalDays} working days, Remaining: ${remainingDays} days`,
                { status: 400 }
            );
        }

        // ── Create Application (with maternity data if applicable) ──
        const application = await prisma.leaveApplication.create({
            data: {
                employeeId: user.employee.id,
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
        });

        // ── ✅ NEW: Create Stateful Approval Request ──
        try {
            await createApprovalRequest({
                entityType: "leave",
                entityId: application.id,
                requestTitle: `${application.leaveType.name}: ${totalDays} day(s) (${format(start, "dd MMM")} - ${format(end, "dd MMM")})`,
                requesterId: user.employee.id,
                organizationId: auth.organizationId,
                priority: isMaternityLeave ? "high" : "normal",
            });
        } catch (approvalError) {
            // Log but don't block — approval request creation failure shouldn't prevent submission
            leaveLogger.error({ err: approvalError }, "APPROVAL_REQUEST_CREATION_ERROR");
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
        return new NextResponse("Internal Error", { status: 500 });
    }
}
