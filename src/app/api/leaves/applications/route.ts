import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated, AuthContext } from "@/lib/api-auth";
import { differenceInDays } from "date-fns";

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

        const applications = await prisma.leaveApplication.findMany({
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
        });

        return NextResponse.json(applications);
    } catch (error) {
        console.error("GET_LEAVE_APPLICATIONS_ERROR", error);
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
        // Get employee profile
        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            include: { employee: true },
        });

        if (!user?.employee) {
            return new NextResponse("Employee profile not found", { status: 400 });
        }

        const json = await req.json();
        const { leaveTypeId, fromDate, toDate, halfDay, halfDayType, reason, documents } = json;

        const start = new Date(fromDate);
        const end = new Date(toDate);

        // Basic validation
        if (end < start) {
            return new NextResponse("End date cannot be before start date", { status: 400 });
        }

        // Calculate duration
        let totalDays = differenceInDays(end, start) + 1;
        if (halfDay) {
            totalDays = 0.5;
        }

        // Fetch Leave Type
        const leaveType = await prisma.leaveType.findUnique({
            where: { id: leaveTypeId },
        });

        if (!leaveType) {
            return new NextResponse("Leave type not found", { status: 404 });
        }

        // Check or Create Allocation
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

        // Check Balance
        const remainingDays = allocation.allocatedDays + allocation.carriedForward - allocation.usedDays;
        if (totalDays > remainingDays) {
            return new NextResponse(`Insufficient leave balance. Remaining: ${remainingDays} days`, { status: 400 });
        }

        // Create Application
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
                documents: documents ? JSON.stringify(documents) : null,
                status: "pending",
            },
        });

        return NextResponse.json(application);
    } catch (error) {
        console.error("CREATE_LEAVE_APPLICATION_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
