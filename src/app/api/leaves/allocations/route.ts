import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { leaveLogger } from "@/lib/logger";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { employee: true },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get("employeeId") || user.employee?.id;

        if (!employeeId) {
            return new NextResponse("Employee ID required", { status: 400 });
        }

        // Strict check: only allow viewing own allocations unless admin/hr/manager
        const userRole = user.role;
        const isAdminOrHR = ["admin", "hr_admin", "manager"].includes(userRole);
        if (!isAdminOrHR && employeeId !== user.employee?.id) {
            return new NextResponse("Forbidden: Cannot view other employee's allocations", { status: 403 });
        }

        const allocations = await prisma.leaveAllocation.findMany({
            where: {
                employeeId: employeeId,
                year: new Date().getFullYear(),
            },
            include: {
                leaveType: true
            }
        });

        // Also get all Leave Types to show 0 balance for those not yet allocated
        const leaveTypes = await prisma.leaveType.findMany({
            where: { organizationId: user.organizationId }
        });

        // Merge: if allocation exists use it, else mock one
        const result = leaveTypes.map(type => {
            const allocation = allocations.find(a => a.leaveTypeId === type.id);
            return {
                leaveType: type,
                allocatedDays: allocation?.allocatedDays || type.annualAllocation,
                usedDays: allocation?.usedDays || 0,
                carriedForward: allocation?.carriedForward || 0,
                // remaining calculated on client or here
                remainingDays: (allocation?.allocatedDays || type.annualAllocation) + (allocation?.carriedForward || 0) - (allocation?.usedDays || 0)
            }
        });

        return NextResponse.json(result);
    } catch (error) {
        leaveLogger.error({ err: error }, "GET_LEAVE_ALLOCATIONS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

/**
 * POST - Create or adjust a specific employee's leave allocation.
 * Use cases: bonus leaves, mid-year adjustments, manual corrections.
 * Admin/HR only.
 */
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
            return new NextResponse("Organization not found", { status: 400 });
        }

        // Only admin/HR can manage allocations
        if (!["admin", "hr_admin"].includes(user.role)) {
            return new NextResponse("Forbidden: Admin/HR access required", { status: 403 });
        }

        const json = await req.json();
        const { employeeId, leaveTypeId, year, allocatedDays, carriedForward, note } = json;

        if (!employeeId || !leaveTypeId || !year || allocatedDays === undefined) {
            return new NextResponse("employeeId, leaveTypeId, year, and allocatedDays are required", { status: 400 });
        }

        // Verify employee belongs to same organization
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, organizationId: user.organizationId },
        });

        if (!employee) {
            return new NextResponse("Employee not found in your organization", { status: 404 });
        }

        // Upsert the allocation
        const allocation = await prisma.leaveAllocation.upsert({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId,
                    leaveTypeId,
                    year: parseInt(year),
                },
            },
            create: {
                employeeId,
                leaveTypeId,
                year: parseInt(year),
                allocatedDays: parseFloat(allocatedDays),
                usedDays: 0,
                carriedForward: parseFloat(carriedForward || "0"),
            },
            update: {
                allocatedDays: parseFloat(allocatedDays),
                ...(carriedForward !== undefined && { carriedForward: parseFloat(carriedForward) }),
            },
            include: {
                leaveType: { select: { name: true, code: true } },
                employee: { select: { firstName: true, lastName: true } },
            },
        });

        return NextResponse.json({
            message: "Allocation updated successfully",
            allocation,
            note: note || undefined,
        });
    } catch (error) {
        leaveLogger.error({ err: error }, "POST_LEAVE_ALLOCATION_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

/**
 * PUT - Bulk initialize allocations for all active employees for a given year.
 * Creates allocations based on each leave type's annualAllocation.
 * Admin/HR only. Safe to run multiple times (uses upsert).
 */
export async function PUT(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        if (!["admin", "hr_admin"].includes(user.role)) {
            return new NextResponse("Forbidden: Admin/HR access required", { status: 403 });
        }

        const json = await req.json();
        const { year } = json;

        if (!year) {
            return new NextResponse("year is required", { status: 400 });
        }

        const targetYear = parseInt(year);

        // Get all active employees and leave types
        const [employees, leaveTypes] = await Promise.all([
            prisma.employee.findMany({
                where: {
                    organizationId: user.organizationId,
                    employmentStatus: "active",
                },
                select: { id: true, firstName: true, lastName: true, gender: true, joiningDate: true },
            }),
            prisma.leaveType.findMany({
                where: {
                    organizationId: user.organizationId,
                    isActive: true,
                },
            }),
        ]);

        let created = 0;
        let skipped = 0;

        for (const employee of employees) {
            for (const leaveType of leaveTypes) {
                // Check gender eligibility
                if (leaveType.applicableGender && leaveType.applicableGender !== "all") {
                    if (employee.gender?.toLowerCase() !== leaveType.applicableGender.toLowerCase()) {
                        skipped++;
                        continue;
                    }
                }

                // Check minimum service days
                if (leaveType.minServiceDays) {
                    const serviceDays = Math.floor(
                        (new Date().getTime() - new Date(employee.joiningDate).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    if (serviceDays < leaveType.minServiceDays) {
                        skipped++;
                        continue;
                    }
                }

                // Upsert — won't override existing data (only creates if not exists)
                await prisma.leaveAllocation.upsert({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId: employee.id,
                            leaveTypeId: leaveType.id,
                            year: targetYear,
                        },
                    },
                    create: {
                        employeeId: employee.id,
                        leaveTypeId: leaveType.id,
                        year: targetYear,
                        allocatedDays: leaveType.annualAllocation,
                        usedDays: 0,
                        carriedForward: 0,
                    },
                    update: {}, // No update — preserve existing allocations
                });

                created++;
            }
        }

        return NextResponse.json({
            message: `Bulk allocation completed for year ${targetYear}`,
            employees: employees.length,
            leaveTypes: leaveTypes.length,
            created,
            skipped,
        });
    } catch (error) {
        leaveLogger.error({ err: error }, "BULK_ALLOCATE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
