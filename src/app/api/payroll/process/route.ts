import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { calculateSalary } from "@/lib/payroll-engine";
import { emit } from "@/lib/event-bus";
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

        // Get eligible employees
        const whereClause: any = {
            organizationId: auth.organizationId,
            employmentStatus: "active",
            deletedAt: null,
            salaryAssignments: {
                some: { isActive: true },
            },
        };

        if (employeeIds && employeeIds.length > 0) {
            whereClause.id = { in: employeeIds };
        }

        const employees = await prisma.employee.findMany({
            where: whereClause,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                user: { select: { id: true, email: true } },
            },
        });

        const skipped: { employeeId: string; name: string; error: string }[] = [];
        const created: {
            employeeId: string;
            name: string;
            netSalary: number;
            overtime: number;
            festivalBonus: number;
            lateDeduction: number;
            loanDeduction: number;
            incomeTax: number;
            status: string;
        }[] = [];

        for (const employee of employees) {
            const empName = `${employee.firstName} ${employee.lastName}`;

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
                skipped.push({
                    employeeId: employee.id,
                    name: empName,
                    error: "Slip already exists",
                });
                continue;
            }

            try {
                // ✅ Use the centralized payroll engine v2
                // This gives us: proper tax slabs, tiered late deduction,
                // festival bonus auto-inclusion, PF ledger posting
                const salary = await calculateSalary({
                    employeeId: employee.id,
                    month,
                    year,
                    postPFContributions: true,
                });

                // Get active loans for auto-deduction within transaction
                const activeLoans = await prisma.loan.findMany({
                    where: {
                        employeeId: employee.id,
                        status: "disbursed",
                        remainingAmount: { gt: 0 },
                    },
                });

                // Atomic: create slip + update loan balances
                await prisma.$transaction(async (tx) => {
                    // Create salary slip with full v2 breakdown
                    await tx.salarySlip.create({
                        data: {
                            employeeId: employee.id,
                            month,
                            year,
                            totalWorkingDays: salary.totalWorkingDays,
                            presentDays: salary.presentDays,
                            absentDays: salary.absentDays,
                            leaveDays: salary.leaveDays,
                            basicSalary: salary.basicSalary,
                            houseRent: salary.houseRent,
                            medicalAllowance: salary.medicalAllowance,
                            conveyance: salary.conveyance,
                            specialAllowance: salary.specialAllowance,
                            overtime: salary.overtime,
                            bonus: salary.bonus,
                            festivalBonus: salary.festivalBonus,
                            arrears: salary.arrears,
                            otherEarnings: salary.otherEarnings,
                            grossSalary: salary.grossSalary,
                            pfEmployee: salary.pfEmployee,
                            pfEmployer: salary.pfEmployer,
                            incomeTax: salary.incomeTax,
                            loanDeduction: salary.loanDeduction,
                            absentDeduction: salary.absentDeduction,
                            lateDeduction: salary.lateDeduction,
                            otherDeductions: salary.otherDeductions,
                            totalDeductions: salary.totalDeductions,
                            netSalary: salary.netSalary,
                            status: "draft",
                        },
                    });

                    // Update loan balances
                    for (const loan of activeLoans) {
                        const deductionAmount = Math.min(loan.emiAmount, loan.remainingAmount);
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
                });

                created.push({
                    employeeId: employee.id,
                    name: empName,
                    netSalary: salary.netSalary,
                    overtime: salary.overtime,
                    festivalBonus: salary.festivalBonus,
                    lateDeduction: salary.lateDeduction,
                    loanDeduction: salary.loanDeduction,
                    incomeTax: salary.incomeTax,
                    status: "created",
                });
            } catch (calcError) {
                skipped.push({
                    employeeId: employee.id,
                    name: empName,
                    error: calcError instanceof Error ? calcError.message : "Calculation failed",
                });
            }
        }

        // ── 🔔 Emit payroll.processed event → triggers notifications + emails ──
        if (created.length > 0) {
            // Build employee results with user data for notifications
            const employeeUserMap = new Map(
                employees.map((e) => [e.id, { userId: e.user?.id, email: e.user?.email }])
            );

            emit("payroll.processed", {
                organizationId: auth.organizationId,
                month,
                year,
                processedCount: created.length,
                employeeResults: created.map((c) => {
                    const userData = employeeUserMap.get(c.employeeId);
                    return {
                        employeeId: c.employeeId,
                        userId: userData?.userId,
                        name: c.name,
                        email: userData?.email || undefined,
                        netSalary: c.netSalary,
                    };
                }),
            }).catch((err) => console.error("[EVENT_FAIL] payroll.processed:", err));
        }

        return NextResponse.json({
            processed: created.length,
            errorCount: skipped.length,
            results: created,
            errors: skipped,
        });
    } catch (error) {
        console.error("PROCESS_PAYROLL_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
