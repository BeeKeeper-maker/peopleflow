import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as z from "zod";

const processPayrollSchema = z.object({
    month: z.number().min(1).max(12),
    year: z.number().min(2020).max(2100),
    employeeIds: z.array(z.string()).optional(), // If empty, process all
});

// GET - List salary slips
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const month = searchParams.get("month");
        const year = searchParams.get("year");
        const employeeId = searchParams.get("employeeId");
        const status = searchParams.get("status");

        const where: any = {
            employee: {
                organizationId: user.organizationId,
            },
        };

        if (month) where.month = parseInt(month);
        if (year) where.year = parseInt(year);
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;

        const slips = await prisma.salarySlip.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                        designation: { select: { name: true } },
                        department: { select: { name: true } },
                    },
                },
            },
            orderBy: [{ year: "desc" }, { month: "desc" }],
        });

        return NextResponse.json(slips);
    } catch (error) {
        console.error("GET_SLIPS_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST - Process payroll for month
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
            return new NextResponse("Organization not found", { status: 400 });
        }

        const body = await req.json();
        const validation = processPayrollSchema.safeParse(body);

        if (!validation.success) {
            return new NextResponse(validation.error.issues[0].message, { status: 400 });
        }

        const { month, year, employeeIds } = validation.data;

        // Get employees with active salary assignments
        const whereClause: any = {
            organizationId: user.organizationId,
            employmentStatus: "active",
            salaryAssignments: {
                some: {
                    isActive: true,
                },
            },
        };

        if (employeeIds && employeeIds.length > 0) {
            whereClause.id = { in: employeeIds };
        }

        const employees = await prisma.employee.findMany({
            where: whereClause,
            include: {
                salaryAssignments: {
                    where: { isActive: true },
                    include: {
                        salaryStructure: true,
                    },
                    take: 1,
                },
                attendances: {
                    where: {
                        date: {
                            gte: new Date(year, month - 1, 1),
                            lt: new Date(year, month, 1),
                        },
                    },
                },
                leaveApplications: {
                    where: {
                        status: "approved",
                        OR: [
                            {
                                fromDate: {
                                    gte: new Date(year, month - 1, 1),
                                    lt: new Date(year, month, 1),
                                },
                            },
                            {
                                toDate: {
                                    gte: new Date(year, month - 1, 1),
                                    lt: new Date(year, month, 1),
                                },
                            },
                        ],
                    },
                },
            },
        });

        const results = [];
        const errors = [];

        // Calculate working days in month
        const daysInMonth = new Date(year, month, 0).getDate();
        let weekends = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const day = new Date(year, month - 1, d).getDay();
            if (day === 5 || day === 6) weekends++; // Friday, Saturday for BD
        }
        const totalWorkingDays = daysInMonth - weekends;

        for (const employee of employees) {
            try {
                // Check if slip already exists
                const existingSlip = await prisma.salarySlip.findUnique({
                    where: {
                        employeeId_month_year: {
                            employeeId: employee.id,
                            month,
                            year,
                        },
                    },
                });

                if (existingSlip) {
                    errors.push({
                        employeeId: employee.id,
                        name: `${employee.firstName} ${employee.lastName}`,
                        error: "Slip already exists",
                    });
                    continue;
                }

                const assignment = employee.salaryAssignments[0];
                if (!assignment) continue;

                const structure = assignment.salaryStructure;
                const gross = assignment.grossSalary;

                // Calculate earnings
                const basic = (gross * structure.basicPercentage) / 100;
                const houseRent = (basic * structure.houseRentPercent) / 100;
                const medical = (basic * structure.medicalPercent) / 100;
                const conveyance = structure.conveyanceFixed;

                // Calculate attendance
                const presentDays = employee.attendances.filter(
                    (a) => a.status === "present" || a.status === "late"
                ).length;
                const leaveDays = employee.leaveApplications.reduce(
                    (sum, l) => sum + l.totalDays,
                    0
                );
                const absentDays = Math.max(0, totalWorkingDays - presentDays - leaveDays);

                // Calculate deductions
                const pfEmployee = (basic * structure.pfEmployeePercent) / 100;
                const pfEmployer = (basic * structure.pfEmployerPercent) / 100;
                const perDaySalary = gross / totalWorkingDays;
                const absentDeduction = absentDays * perDaySalary;

                // Calculate late deduction (if > 3 times late, deduct half day per 3 lates)
                const lateDays = employee.attendances.filter((a) => a.status === "late").length;
                const lateDeduction = Math.floor(lateDays / 3) * (perDaySalary / 2);

                const totalDeductions = pfEmployee + absentDeduction + lateDeduction;
                const netSalary = gross - totalDeductions;

                // Create salary slip
                const slip = await prisma.salarySlip.create({
                    data: {
                        employeeId: employee.id,
                        month,
                        year,
                        totalWorkingDays,
                        presentDays,
                        absentDays,
                        leaveDays: Math.round(leaveDays),
                        basicSalary: Math.round(basic),
                        houseRent: Math.round(houseRent),
                        medicalAllowance: Math.round(medical),
                        conveyance: Math.round(conveyance),
                        grossSalary: Math.round(gross),
                        pfEmployee: Math.round(pfEmployee),
                        pfEmployer: Math.round(pfEmployer),
                        absentDeduction: Math.round(absentDeduction),
                        lateDeduction: Math.round(lateDeduction),
                        totalDeductions: Math.round(totalDeductions),
                        netSalary: Math.round(netSalary),
                        status: "draft",
                    },
                });

                results.push({
                    employeeId: employee.id,
                    name: `${employee.firstName} ${employee.lastName}`,
                    netSalary: slip.netSalary,
                    status: "created",
                });
            } catch (err) {
                errors.push({
                    employeeId: employee.id,
                    name: `${employee.firstName} ${employee.lastName}`,
                    error: err instanceof Error ? err.message : "Unknown error",
                });
            }
        }

        return NextResponse.json({
            processed: results.length,
            errorCount: errors.length,
            results,
            errors,
        });
    } catch (error) {
        console.error("PROCESS_PAYROLL_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
