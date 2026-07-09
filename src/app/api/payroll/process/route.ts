import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { calculateSalary, toNumber } from "@/lib/payroll-engine";
import { emit } from "@/lib/event-bus";
import * as z from "zod";
import { payrollLogger } from "@/lib/logger";

const processPayrollSchema = z.object({
    month: z.number().min(1).max(12),
    year: z.number().min(2020).max(2100),
    employeeIds: z.array(z.string()).optional(), // If empty, process all
    // ── Manual adjustments (applied to every processed slip) ──
    // These let HR give an ad-hoc bonus, arrear, or deduction at process time.
    // For per-employee adjustments, process each employee separately with
    // a custom overrides object (future enhancement: overrides map).
    bonus: z.number().min(0).optional(),
    arrears: z.number().min(0).optional(),
    otherEarnings: z.number().min(0).optional(),
    otherDeductions: z.number().min(0).optional(),
});

// GET - List salary slips (paginated)
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

        // Pagination with hard cap
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
        const skip = (page - 1) * limit;

        const where: any = {
            employee: {
                organizationId: auth.organizationId,
            },
        };

        if (month) where.month = parseInt(month);
        if (year) where.year = parseInt(year);
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;

        const [slips, totalCount] = await auth.withDB((db) =>
            Promise.all([
                db.salarySlip.findMany({
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
                    skip,
                    take: limit,
                }),
                db.salarySlip.count({ where }),
            ]),
        );

        return NextResponse.json({
            data: slips.map((slip) => ({
                ...slip,
                // Phase 1 (Float → Decimal): convert Decimal fields back to numbers
                // so JSON serialization produces numbers, not strings. The frontend
                // (useSalarySlips hook + payroll page) expects numbers for arithmetic
                // like `slips.reduce((sum, s) => sum + s.netSalary, 0)`.
                totalWorkingDays: toNumber(slip.totalWorkingDays),
                presentDays: toNumber(slip.presentDays),
                absentDays: toNumber(slip.absentDays),
                leaveDays: toNumber(slip.leaveDays),
                basicSalary: toNumber(slip.basicSalary),
                houseRent: toNumber(slip.houseRent),
                medicalAllowance: toNumber(slip.medicalAllowance),
                conveyance: toNumber(slip.conveyance),
                specialAllowance: toNumber(slip.specialAllowance),
                overtime: toNumber(slip.overtime),
                bonus: toNumber(slip.bonus),
                festivalBonus: toNumber(slip.festivalBonus),
                arrears: toNumber(slip.arrears),
                otherEarnings: toNumber(slip.otherEarnings),
                grossSalary: toNumber(slip.grossSalary),
                pfEmployee: toNumber(slip.pfEmployee),
                pfEmployer: toNumber(slip.pfEmployer),
                incomeTax: toNumber(slip.incomeTax),
                loanDeduction: toNumber(slip.loanDeduction),
                absentDeduction: toNumber(slip.absentDeduction),
                lateDeduction: toNumber(slip.lateDeduction),
                otherDeductions: toNumber(slip.otherDeductions),
                totalDeductions: toNumber(slip.totalDeductions),
                netSalary: toNumber(slip.netSalary),
            })),
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasMore: page * limit < totalCount,
            },
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "GET_SLIPS_ERROR");
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

        const { month, year, employeeIds, bonus, arrears, otherEarnings, otherDeductions } = validation.data;

        const hasExplicitEmployeeSelection = !!employeeIds && employeeIds.length > 0;

        // Get eligible employees. Bulk payroll processes only active employees.
        // Explicit employeeIds may include offboarded/terminated employees for final-settlement payroll
        // without reactivating their ESS access or salary assignment.
        const whereClause: any = {
            organizationId: auth.organizationId,
            ...(hasExplicitEmployeeSelection
                ? {
                    id: { in: employeeIds },
                    salaryAssignments: {
                        some: {
                            effectiveFrom: { lte: new Date(year, month - 1, 28) },
                            OR: [
                                { effectiveTo: null },
                                { effectiveTo: { gte: new Date(year, month - 1, 1) } },
                            ],
                        },
                    },
                }
                : {
                    employmentStatus: "active",
                    deletedAt: null,
                    salaryAssignments: {
                        some: { isActive: true },
                    },
                }),
        };

        const employees = await auth.withDB((db) =>
            db.employee.findMany({
                where: whereClause,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    user: { select: { id: true, email: true } },
                },
            }),
        );

        const allEmployeeIds = employees.map((e) => e.id);

        // ─── GATHER PHASE: Batch-fetch all data in 2 queries (not N) ───────
        const [existingSlips, allActiveLoans] = await auth.withDB((db) =>
            Promise.all([
                // 1. Existing slips for this month/year — prevents per-employee findUnique
                //    Include isLocked so we can skip locked slips (paid + locked = no re-process)
                db.salarySlip.findMany({
                    where: {
                        employeeId: { in: allEmployeeIds },
                        month,
                        year,
                    },
                    select: { employeeId: true, isLocked: true, isReversed: true, status: true },
                }),
                // 2. All active loans for all employees — prevents N+1 in the loop
                db.loan.findMany({
                    where: {
                        employeeId: { in: allEmployeeIds },
                        status: "disbursed",
                        remainingAmount: { gt: 0 },
                    },
                }),
            ]),
        );

        // ─── BUILD INDEXES: O(1) lookup per employee ───────────────────────
        // A slip is "blocking" if it exists AND is not reversed AND (is locked OR not locked)
        // i.e. any non-reversed existing slip blocks re-processing.
        // Locked slips explicitly block with a clear error message.
        const existingSlipMap = new Map<string, { isLocked: boolean; isReversed: boolean; status: string }>();
        for (const s of existingSlips) {
            existingSlipMap.set(s.employeeId, {
                isLocked: s.isLocked,
                isReversed: s.isReversed,
                status: s.status,
            });
        }
        const existingSlipSet = new Set(
            existingSlips.filter((s) => !s.isReversed).map((s) => s.employeeId),
        );
        const loansByEmployee = new Map<string, typeof allActiveLoans>();
        for (const loan of allActiveLoans) {
            if (!loansByEmployee.has(loan.employeeId)) {
                loansByEmployee.set(loan.employeeId, []);
            }
            loansByEmployee.get(loan.employeeId)!.push(loan);
        }

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

            // ─── MATCH PHASE: O(1) lookup from pre-built indexes ───────────
            // Skip if a non-reversed slip already exists.
            // Locked slips get a specific error message so HR knows to
            // unlock (with audit) before re-processing.
            const existingInfo = existingSlipMap.get(employee.id);
            if (existingInfo && !existingInfo.isReversed) {
                skipped.push({
                    employeeId: employee.id,
                    name: empName,
                    error: existingInfo.isLocked
                        ? `Slip is LOCKED (status: ${existingInfo.status}). Unlock it first to re-process.`
                        : `Slip already exists (status: ${existingInfo.status}). Reverse it first to re-process.`,
                });
                continue;
            }

            try {
                // ✅ Use the centralized payroll engine v2
                // This gives us: proper tax slabs, tiered late deduction,
                // festival bonus auto-inclusion, PF ledger posting.
                // Manual adjustments (bonus/arrears/other) are passed through
                // so HR can give ad-hoc earnings/deductions at process time.
                //
                // ── Atomicity note ──────────────────────────────────────────
                // `postPFContributions: false` defers PF ledger posting so we
                // can post it AFTER the slip is successfully created. If slip
                // creation fails we also roll back any festival bonus that
                // `getFestivalBonusForPayroll()` marked as included_in_payroll
                // (it marks bonuses inside calculateSalary() since it can't be
                // cleanly split). This prevents the data inconsistency where
                // PF is posted / festival bonus is marked but no salary slip
                // exists for the period.
                const salary = await calculateSalary({
                    employeeId: employee.id,
                    month,
                    year,
                    postPFContributions: false,
                    includeInactiveAssignment: hasExplicitEmployeeSelection,
                    bonus: bonus ?? 0,
                    arrears: arrears ?? 0,
                    otherEarnings: otherEarnings ?? 0,
                    otherDeductions: otherDeductions ?? 0,
                });

                // Get active loans from pre-built Map (O(1) instead of DB query)
                const activeLoans = loansByEmployee.get(employee.id) || [];

                // Atomic: create slip + update loan balances + post PF (withDB wraps in transaction)
                // If ANY of these fail, we roll back the festival bonus marking
                // done inside calculateSalary() so bonuses remain "pending" for re-processing.
                try {
                    await auth.withDB(async (db) => {
                        // Create salary slip with full v2 breakdown
                        await db.salarySlip.create({
                            data: {
                                employeeId: employee.id,
                                organizationId: auth.organizationId,
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

                            await db.loan.update({
                                where: { id: loan.id },
                                data: {
                                    paidAmount: newPaid,
                                    remainingAmount: newRemaining,
                                    status: newRemaining <= 0 ? "closed" : "disbursed",
                                },
                            });
                        }
                    });
                } catch (slipError) {
                    // ── Rollback: unmark festival bonuses that calculateSalary() marked ──
                    // Without this, a failed slip creation would leave bonuses permanently
                    // tagged as "included_in_payroll" with no actual payslip — they would
                    // never be paid out and never be re-pickable by the next payroll run.
                    if (salary.festivalBonus > 0) {
                        try {
                            await auth.withDB((db) =>
                                db.festivalBonusPayment.updateMany({
                                    where: {
                                        employeeId: employee.id,
                                        status: "included_in_payroll",
                                        payrollMonth: month,
                                        payrollYear: year,
                                    },
                                    data: {
                                        status: "pending",
                                        payrollMonth: null,
                                        payrollYear: null,
                                    },
                                }),
                            );
                        } catch (rollbackError) {
                            payrollLogger.error(
                                { err: rollbackError, employeeId: employee.id, month, year },
                                "FESTIVAL_BONUS_ROLLBACK_FAILED",
                            );
                        }
                    }
                    // Re-throw so the outer catch logs it as a skip
                    throw slipError;
                }

                // ── Post PF contributions ONLY after slip is committed ──
                // calculateSalary() returned the computed PF amounts but did NOT
                // post them (we passed postPFContributions: false). Post now so
                // PF is never recorded for a period without a salary slip.
                if (salary.pfEmployee > 0) {
                    try {
                        const { recordMonthlyContributions } = await import("@/lib/pf-ledger-engine");
                        await recordMonthlyContributions({
                            employeeId: employee.id,
                            month,
                            year,
                            employeeAmount: salary.pfEmployee,
                            employerAmount: salary.pfEmployer,
                        });
                    } catch (pfError) {
                        // PF posting failure should NOT block salary calculation
                        // (slip is already created; PF has an idempotency guard
                        // and can be re-posted from the PF ledger reconciliation tool).
                        payrollLogger.error({ err: pfError, employeeId: employee.id }, "Failed to post PF contribution");
                    }
                }

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
            }).catch((err) => payrollLogger.error({ err: err }, "[EVENT_FAIL] payroll.processed:"));
        }

        return NextResponse.json({
            processed: created.length,
            errorCount: skipped.length,
            results: created,
            errors: skipped,
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "PROCESS_PAYROLL_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
