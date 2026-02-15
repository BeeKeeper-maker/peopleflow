import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import * as z from "zod";

const processPayrollSchema = z.object({
    month: z.number().min(1).max(12),
    year: z.number().min(2020).max(2100),
    employeeIds: z.array(z.string()).optional(), // If empty, process all
});

// GET - List salary slips
export async function GET(req: Request) {
    try {
        // Require HR admin role for viewing salary slips
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const { searchParams } = new URL(req.url);
        const month = searchParams.get("month");
        const year = searchParams.get("year");
        const employeeId = searchParams.get("employeeId");
        const status = searchParams.get("status");

        const where: any = {
            employee: {
                organizationId: auth.organizationId,
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
        // Require HR admin role for processing payroll
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const body = await req.json();
        const validation = processPayrollSchema.safeParse(body);

        if (!validation.success) {
            return new NextResponse(validation.error.issues[0].message, { status: 400 });
        }

        const { month, year, employeeIds } = validation.data;

        // Get employees with active salary assignments, attendance, leaves, and loans
        const whereClause: any = {
            organizationId: auth.organizationId,
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
                loans: {
                    where: {
                        status: "disbursed",
                        remainingAmount: { gt: 0 },
                    },
                },
            },
        });

        const skipped: { employeeId: string; name: string; error: string }[] = [];

        // Calculate working days in month
        const daysInMonth = new Date(year, month, 0).getDate();
        let weekends = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const day = new Date(year, month - 1, d).getDay();
            if (day === 5 || day === 6) weekends++; // Friday, Saturday for BD
        }
        const totalWorkingDays = daysInMonth - weekends;

        // Pre-filter: skip employees who already have slips
        const eligibleEmployees: typeof employees = [];
        for (const employee of employees) {
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
                skipped.push({
                    employeeId: employee.id,
                    name: `${employee.firstName} ${employee.lastName}`,
                    error: "Slip already exists",
                });
                continue;
            }

            const assignment = employee.salaryAssignments[0];
            if (!assignment) {
                skipped.push({
                    employeeId: employee.id,
                    name: `${employee.firstName} ${employee.lastName}`,
                    error: "No active salary assignment",
                });
                continue;
            }

            eligibleEmployees.push(employee);
        }

        if (eligibleEmployees.length === 0) {
            return NextResponse.json({
                processed: 0,
                errorCount: skipped.length,
                results: [],
                errors: skipped,
            });
        }

        // Single atomic transaction for ALL eligible employees
        const results = await prisma.$transaction(async (tx) => {
            const created: {
                employeeId: string;
                name: string;
                netSalary: number;
                overtime: number;
                loanDeduction: number;
                incomeTax: number;
                status: string;
            }[] = [];

            for (const employee of eligibleEmployees) {
                const assignment = employee.salaryAssignments[0];
                const structure = assignment.salaryStructure;
                const gross = assignment.grossSalary;

                // ─── EARNINGS ───
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

                // ─── OVERTIME ───
                const totalOvertimeMinutes = employee.attendances.reduce(
                    (sum, a) => sum + (a.overtimeMinutes || 0),
                    0
                );
                const overtimeHours = totalOvertimeMinutes / 60;
                const hourlyBasic = basic / (totalWorkingDays * 8);
                const overtimePay = Math.round(overtimeHours * hourlyBasic * 1.5);

                // ─── DEDUCTIONS ───
                const pfEmployee = employee.pfEnabled !== false
                    ? (basic * structure.pfEmployeePercent) / 100
                    : 0;
                const pfEmployer = employee.pfEnabled !== false
                    ? (basic * structure.pfEmployerPercent) / 100
                    : 0;

                const perDaySalary = gross / totalWorkingDays;
                const absentDeduction = absentDays * perDaySalary;

                const lateDays = employee.attendances.filter((a) => a.status === "late").length;
                const lateDeduction = Math.floor(lateDays / 3) * (perDaySalary / 2);

                // ─── LOAN AUTO-DEDUCTION ───
                let loanDeduction = 0;

                for (const loan of employee.loans) {
                    const deductionAmount = Math.min(loan.emiAmount, loan.remainingAmount);
                    loanDeduction += deductionAmount;

                    const newPaid = loan.paidAmount + deductionAmount;
                    const newRemaining = loan.remainingAmount - deductionAmount;

                    await tx.loan.update({
                        where: { id: loan.id },
                        data: {
                            paidAmount: newPaid,
                            remainingAmount: newRemaining,
                            status: newRemaining <= 0 ? "closed" : "disbursed",
                        },
                    });
                }

                // ─── INCOME TAX (simplified TDS) ───
                const annualGross = gross * 12;
                const incomeTax = annualGross > 300000 ? Math.round((gross * 5) / 100) : 0;

                // ─── TOTALS ───
                const totalDeductions = pfEmployee + absentDeduction + lateDeduction + loanDeduction + incomeTax;
                const netSalary = gross + overtimePay - totalDeductions;

                // Create salary slip
                const slip = await tx.salarySlip.create({
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
                        overtime: Math.round(overtimePay),
                        grossSalary: Math.round(gross),
                        pfEmployee: Math.round(pfEmployee),
                        pfEmployer: Math.round(pfEmployer),
                        incomeTax: Math.round(incomeTax),
                        loanDeduction: Math.round(loanDeduction),
                        absentDeduction: Math.round(absentDeduction),
                        lateDeduction: Math.round(lateDeduction),
                        totalDeductions: Math.round(totalDeductions),
                        netSalary: Math.round(netSalary),
                        status: "draft",
                    },
                });

                created.push({
                    employeeId: employee.id,
                    name: `${employee.firstName} ${employee.lastName}`,
                    netSalary: slip.netSalary,
                    overtime: Math.round(overtimePay),
                    loanDeduction: Math.round(loanDeduction),
                    incomeTax: Math.round(incomeTax),
                    status: "created",
                });
            }

            return created;
        });

        return NextResponse.json({
            processed: results.length,
            errorCount: skipped.length,
            results,
            errors: skipped,
        });
    } catch (error) {
        console.error("PROCESS_PAYROLL_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

