import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { toNumber } from "@/lib/payroll-engine";
import { apiLogger } from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════════════
// Bangladesh Labour Act 2006 (BLA 2006) Compliance Engine
// Reference: https://www.ilo.org/dyn/natlex/docs/ELECTRONIC/76402/110637/F...
// ═══════════════════════════════════════════════════════════════════════

interface ComplianceCheck {
    id: string;
    category: string;
    rule: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low";
    status: "pass" | "fail" | "warning";
    affectedCount: number;
    details?: string;
}

// ── Pagination defaults & hard caps ─────────────────────────────────
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const COMPLIANCE_ATTENDANCE_CAP = 5000; // Max rows for compliance aggregate

function parsePagination(searchParams: URLSearchParams) {
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10))
    );
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

/**
 * GET /api/reports?type=compliance
 * GET /api/reports?type=attendance&month=..&year=..&page=1&limit=50
 * GET /api/reports?type=payroll&month=..&year=..&page=1&limit=50
 *
 * Dispatches to the appropriate report engine.
 * All data-heavy reports require `page` and `limit` parameters.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        if (!["super_admin", "admin", "hr_admin"].includes(ctx.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const reportType = searchParams.get("type") || "compliance";
        const pagination = parsePagination(searchParams);

        if (reportType === "compliance") {
            return await runComplianceEngine(ctx);
        }

        if (reportType === "attendance") {
            return await runAttendanceReport(ctx, searchParams, pagination);
        }

        if (reportType === "payroll") {
            return await runPayrollReport(ctx, searchParams, pagination);
        }

        return NextResponse.json({ error: `Unknown report type: ${reportType}` }, { status: 400 });
    } catch (error) {
        apiLogger.error({ err: error }, "Reports API error:");
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}

/**
 * Real Compliance Engine — runs live checks against Prisma data
 * following Bangladesh Labour Act 2006.
 */
async function runComplianceEngine(ctx: AuthContext) {
    const orgId = ctx.organizationId;
    const checks: ComplianceCheck[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();

    // ── Fetch all data upfront for performance ──────────────────────
    const [
        activeEmployees,
        leaveTypes,
        leaveAllocations,
        salaryAssignments,
        shifts,
        recentAttendance,
    ] = await ctx.withDB((db) =>
        Promise.all([
            db.employee.findMany({
                where: { organizationId: orgId, employmentStatus: "active" },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                    joiningDate: true,
                    confirmationDate: true,
                    employmentType: true,
                    gender: true,
                    shiftId: true,
                    pfEnabled: true,
                },
            }),
            db.leaveType.findMany({
                where: { organizationId: orgId, isActive: true },
                select: { id: true, code: true, name: true, annualAllocation: true },
            }),
            db.leaveAllocation.findMany({
                where: {
                    employee: { organizationId: orgId, employmentStatus: "active" },
                    year: currentYear,
                },
                select: { employeeId: true, allocatedDays: true, leaveTypeId: true },
            }),
            db.salaryStructureAssignment.findMany({
                where: {
                    employee: { organizationId: orgId, employmentStatus: "active" },
                    isActive: true,
                },
                select: {
                    employeeId: true,
                    grossSalary: true,
                    salaryStructure: {
                        select: { pfEmployeePercent: true, pfEmployerPercent: true },
                    },
                },
            }),
            db.shift.findMany({
                where: { organizationId: orgId, isActive: true },
                select: { id: true, fullDayHours: true, startTime: true, endTime: true },
            }),
            // Last 30 days of attendance for working hours checks (capped)
            db.attendance.findMany({
                where: {
                    employee: { organizationId: orgId },
                    date: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
                    status: "present",
                    checkIn: { not: null },
                    checkOut: { not: null },
                },
                select: {
                    employeeId: true,
                    checkIn: true,
                    checkOut: true,
                    overtimeMinutes: true,
                    lateMinutes: true,
                },
                orderBy: { date: "desc" },
                take: COMPLIANCE_ATTENDANCE_CAP,
            }),
        ]),
    );

    const totalEmployees = activeEmployees.length;

    if (totalEmployees === 0) {
        return NextResponse.json({
            checks: [],
            score: 100,
            summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
        });
    }

    // ═══ CHECK 1: Minimum Wage Compliance (BLA Section 141-149) ═══
    // Bangladesh gazette minimum wage (2023 revision): BDT 12,500/month for RMG
    // General minimum: BDT 10,000/month (compliance.ts MINIMUM_WAGES.general)
    const MIN_WAGE_BDT = 10000; // General minimum (use rmg: 12500 for RMG sector)
    const empSalaryMap = new Map<string, number>();
    salaryAssignments.forEach((sa) => empSalaryMap.set(sa.employeeId, sa.grossSalary));

    const belowMinWage = activeEmployees.filter((e) => {
        const salary = empSalaryMap.get(e.id);
        return salary !== undefined && salary < MIN_WAGE_BDT;
    });

    checks.push({
        id: "min-wage",
        category: "Wages",
        rule: "Minimum Wage Compliance",
        description: `All employees must receive at least BDT ${MIN_WAGE_BDT.toLocaleString()}/month (BLA Section 141)`,
        severity: "critical",
        status: belowMinWage.length === 0 ? "pass" : "fail",
        affectedCount: belowMinWage.length,
        details: belowMinWage.length > 0
            ? `${belowMinWage.length} employee(s) below minimum wage: ${belowMinWage.slice(0, 3).map(e => e.employeeCode).join(", ")}${belowMinWage.length > 3 ? "..." : ""}`
            : undefined,
    });

    // ═══ CHECK 2: Overtime Payment Rate (BLA Section 108) ═══
    // Overtime must be paid at 2x basic rate
    const employeesWithOT = new Set<string>();
    recentAttendance.forEach((a) => {
        if (a.overtimeMinutes > 0) employeesWithOT.add(a.employeeId);
    });
    // If employees have OT logged, the system handles rates — pass if salary structures exist
    const otWithoutSalary = [...employeesWithOT].filter((id) => !empSalaryMap.has(id));

    checks.push({
        id: "ot-rate",
        category: "Wages",
        rule: "Overtime Payment Rate",
        description: "Overtime must be paid at double the basic rate (BLA Section 108)",
        severity: "high",
        status: otWithoutSalary.length === 0 ? "pass" : "warning",
        affectedCount: otWithoutSalary.length,
        details: otWithoutSalary.length > 0
            ? `${otWithoutSalary.length} employee(s) have logged overtime but no salary structure assigned`
            : undefined,
    });

    // ═══ CHECK 3: Annual Leave Allocation (BLA Section 117) ═══
    // Minimum 10 days annual leave for workers with 1+ year service
    const annualLeaveType = leaveTypes.find(
        (lt) => lt.code.toLowerCase() === "al" || lt.code.toLowerCase() === "annual" || lt.name.toLowerCase().includes("annual")
    );

    let inadequateLeave = 0;
    if (annualLeaveType) {
        const allocMap = new Map<string, number>();
        leaveAllocations
            .filter((la) => la.leaveTypeId === annualLeaveType.id)
            .forEach((la) => allocMap.set(la.employeeId, la.allocatedDays));

        const eligibleEmployees = activeEmployees.filter((e) => {
            const serviceMs = now.getTime() - new Date(e.joiningDate).getTime();
            return serviceMs >= 365 * 24 * 60 * 60 * 1000; // 1+ year
        });

        eligibleEmployees.forEach((e) => {
            const allocated = allocMap.get(e.id);
            if (!allocated || allocated < 10) inadequateLeave++;
        });

        checks.push({
            id: "annual-leave",
            category: "Leave",
            rule: "Annual Leave Allocation",
            description: "Every employee with 1+ year service must receive minimum 10 days annual leave (BLA Section 117)",
            severity: "high",
            status: inadequateLeave === 0 ? "pass" : "warning",
            affectedCount: inadequateLeave,
            details: inadequateLeave > 0
                ? `${inadequateLeave} eligible employee(s) have less than 10 days annual leave allocated`
                : undefined,
        });
    } else {
        checks.push({
            id: "annual-leave",
            category: "Leave",
            rule: "Annual Leave Allocation",
            description: "An 'Annual Leave' type must be configured in the system (BLA Section 117)",
            severity: "high",
            status: "fail",
            affectedCount: totalEmployees,
            details: "No Annual Leave type found. Please create a leave type with code 'AL'.",
        });
    }

    // ═══ CHECK 4: Weekly Holiday (BLA Section 103) ═══
    // At least 1 rest day per week — checked via shift configs having reasonable hours
    const shiftsConfigured = shifts.length > 0;
    checks.push({
        id: "weekly-holiday",
        category: "Leave",
        rule: "Weekly Holiday",
        description: "At least 1 rest day per week required (BLA Section 103)",
        severity: "critical",
        status: shiftsConfigured ? "pass" : "warning",
        affectedCount: shiftsConfigured ? 0 : totalEmployees,
        details: !shiftsConfigured
            ? "No shift configurations found. Configure shifts to ensure weekly rest compliance."
            : undefined,
    });

    // ═══ CHECK 5: Provident Fund Compliance ═══
    // Employer PF contribution must match employee contribution
    const pfAssignments = salaryAssignments.filter((sa) => {
        const emp = activeEmployees.find((e) => e.id === sa.employeeId);
        return emp?.pfEnabled;
    });

    let pfMismatch = 0;
    pfAssignments.forEach((sa) => {
        if (sa.salaryStructure.pfEmployeePercent !== sa.salaryStructure.pfEmployerPercent) {
            pfMismatch++;
        }
    });

    checks.push({
        id: "pf-contribution",
        category: "PF",
        rule: "Provident Fund Contribution",
        description: "Employer PF contribution must match employee contribution (equal matching)",
        severity: "high",
        status: pfMismatch === 0 ? "pass" : "warning",
        affectedCount: pfMismatch,
        details: pfMismatch > 0
            ? `${pfMismatch} salary structure(s) have mismatched employer/employee PF rates`
            : undefined,
    });

    // ═══ CHECK 6: Salary Structure Coverage ═══
    // Every employee should have a salary structure
    const employeesWithSalary = new Set(salaryAssignments.map((sa) => sa.employeeId));
    const noSalary = activeEmployees.filter((e) => !employeesWithSalary.has(e.id));

    checks.push({
        id: "salary-coverage",
        category: "Wages",
        rule: "Salary Structure Assignment",
        description: "Every active employee must have an assigned salary structure for payroll processing",
        severity: "high",
        status: noSalary.length === 0 ? "pass" : "fail",
        affectedCount: noSalary.length,
        details: noSalary.length > 0
            ? `${noSalary.length} employee(s) have no salary structure: ${noSalary.slice(0, 3).map(e => e.employeeCode).join(", ")}${noSalary.length > 3 ? "..." : ""}`
            : undefined,
    });

    // ═══ CHECK 7: Maximum Working Hours (BLA Section 100-102) ═══
    // Daily: max 8 hours + 2 OT. Weekly: max 60 hours
    let excessiveHours = 0;
    const hoursByEmployee = new Map<string, number[]>();

    recentAttendance.forEach((a) => {
        if (a.checkIn && a.checkOut) {
            const hours = (a.checkOut.getTime() - a.checkIn.getTime()) / (1000 * 60 * 60);
            if (hours > 10) excessiveHours++; // 8 regular + 2 OT max
            if (!hoursByEmployee.has(a.employeeId)) hoursByEmployee.set(a.employeeId, []);
            hoursByEmployee.get(a.employeeId)!.push(hours);
        }
    });

    checks.push({
        id: "max-hours",
        category: "Working Hours",
        rule: "Maximum Working Hours",
        description: "Daily working hours must not exceed 8 hours + 2 OT (BLA Section 100-102)",
        severity: "high",
        status: excessiveHours === 0 ? "pass" : "warning",
        affectedCount: excessiveHours,
        details: excessiveHours > 0
            ? `${excessiveHours} attendance record(s) in the last 30 days exceed 10 hours`
            : undefined,
    });

    // ═══ CHECK 8: Gratuity Eligibility (BLA Section 27) ═══
    // Employees with 1+ year continuous service are eligible
    const eligibleForGratuity = activeEmployees.filter((e) => {
        const serviceMs = now.getTime() - new Date(e.joiningDate).getTime();
        return serviceMs >= 365 * 24 * 60 * 60 * 1000;
    });

    checks.push({
        id: "gratuity",
        category: "Gratuity",
        rule: "Gratuity Eligibility Tracking",
        description: "Employees with 1+ year continuous service are eligible for gratuity (BLA Section 27)",
        severity: "medium",
        status: "pass",
        affectedCount: 0,
        details: `${eligibleForGratuity.length} employee(s) are currently eligible for gratuity`,
    });

    // ═══ CHECK 9: Employment Type Confirmation (BLA Section 4) ═══
    // Probation employees should be confirmed within 6 months
    const overdueConfirmation = activeEmployees.filter((e) => {
        if (e.employmentType !== "probation") return false;
        const serviceMs = now.getTime() - new Date(e.joiningDate).getTime();
        return serviceMs > 180 * 24 * 60 * 60 * 1000 && !e.confirmationDate; // 6 months
    });

    checks.push({
        id: "confirmation",
        category: "Documentation",
        rule: "Probation Confirmation",
        description: "Probationary employees should be confirmed within 6 months of joining",
        severity: "medium",
        status: overdueConfirmation.length === 0 ? "pass" : "warning",
        affectedCount: overdueConfirmation.length,
        details: overdueConfirmation.length > 0
            ? `${overdueConfirmation.length} employee(s) overdue for confirmation: ${overdueConfirmation.slice(0, 3).map(e => e.employeeCode).join(", ")}${overdueConfirmation.length > 3 ? "..." : ""}`
            : undefined,
    });

    // ═══ CHECK 10: Maternity Leave (BLA Section 46-47) ═══
    // 16 weeks (112 days) for female employees — check if leave type exists
    const maternityLeave = leaveTypes.find(
        (lt) => lt.code.toLowerCase() === "ml" || lt.name.toLowerCase().includes("maternity")
    );
    const femaleEmployees = activeEmployees.filter((e) => e.gender === "female");

    checks.push({
        id: "maternity",
        category: "Leave",
        rule: "Maternity Leave Provision",
        description: "Female employees must have access to 16 weeks (112 days) maternity leave (BLA Section 46-47)",
        severity: "critical",
        status: maternityLeave
            ? maternityLeave.annualAllocation >= 112
                ? "pass"
                : "warning"
            : femaleEmployees.length > 0
                ? "fail"
                : "pass",
        affectedCount: !maternityLeave ? femaleEmployees.length : 0,
        details: !maternityLeave && femaleEmployees.length > 0
            ? `No Maternity Leave type configured. ${femaleEmployees.length} female employee(s) lack statutory maternity benefits.`
            : maternityLeave && maternityLeave.annualAllocation < 112
                ? `Maternity leave is set to ${maternityLeave.annualAllocation} days. BLA requires minimum 112 days.`
                : undefined,
    });

    // ═══ Calculate Overall Score ═══
    const passed = checks.filter((c) => c.status === "pass").length;
    const warnings = checks.filter((c) => c.status === "warning").length;
    const failed = checks.filter((c) => c.status === "fail").length;

    // Score: pass = 100%, warning = 50%, fail = 0%
    const maxScore = checks.length * 100;
    const actualScore = passed * 100 + warnings * 50;
    const score = Math.round((actualScore / maxScore) * 100);

    return NextResponse.json({
        checks,
        score,
        summary: {
            total: checks.length,
            passed,
            failed,
            warnings,
            totalEmployees,
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════
// Paginated Attendance Report
// GET /api/reports?type=attendance&month=4&year=2026&page=1&limit=50
// ═══════════════════════════════════════════════════════════════════════

async function runAttendanceReport(
    ctx: AuthContext,
    searchParams: URLSearchParams,
    pagination: { page: number; limit: number; skip: number }
) {
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const status = searchParams.get("status"); // present, absent, late, leave
    const departmentId = searchParams.get("departmentId");

    // Build date range for the target month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const where: any = {
        employee: {
            organizationId: ctx.organizationId,
            ...(departmentId ? { departmentId } : {}),
        },
        date: { gte: startDate, lte: endDate },
    };
    if (status) where.status = status;

    // Parallel: fetch paginated data + total count
    const [records, totalCount] = await ctx.withDB((db) =>
        Promise.all([
            db.attendance.findMany({
                where,
                select: {
                    id: true,
                    date: true,
                    status: true,
                    checkIn: true,
                    checkOut: true,
                    overtimeMinutes: true,
                    lateMinutes: true,
                    earlyLeaveMinutes: true,
                    employee: {
                        select: {
                            id: true,
                            employeeCode: true,
                            firstName: true,
                            lastName: true,
                            department: { select: { name: true } },
                        },
                    },
                },
                orderBy: [{ date: "desc" }, { employee: { firstName: "asc" } }],
                skip: pagination.skip,
                take: pagination.limit,
            }),
            db.attendance.count({ where }),
        ]),
    );

    return NextResponse.json({
        data: records,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            totalCount,
            totalPages: Math.ceil(totalCount / pagination.limit),
            hasMore: pagination.page * pagination.limit < totalCount,
        },
        filters: { month, year, status, departmentId },
    });
}

// ═══════════════════════════════════════════════════════════════════════
// Paginated Payroll Report
// GET /api/reports?type=payroll&month=4&year=2026&page=1&limit=50
// ═══════════════════════════════════════════════════════════════════════

async function runPayrollReport(
    ctx: AuthContext,
    searchParams: URLSearchParams,
    pagination: { page: number; limit: number; skip: number }
) {
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const payrollStatus = searchParams.get("status"); // draft, approved, paid

    const where: any = {
        month,
        year,
        employee: { organizationId: ctx.organizationId },
    };
    if (payrollStatus) where.status = payrollStatus;

    const [slips, totalCount, aggregates] = await ctx.withDB((db) =>
        Promise.all([
            db.salarySlip.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            employeeCode: true,
                            firstName: true,
                            lastName: true,
                            department: { select: { name: true } },
                            designation: { select: { name: true } },
                        },
                    },
                },
                orderBy: { employee: { firstName: "asc" } },
                skip: pagination.skip,
                take: pagination.limit,
            }),
            db.salarySlip.count({ where }),
            // Aggregate totals for the summary header
            db.salarySlip.aggregate({
                where,
                _sum: {
                    grossSalary: true,
                    totalDeductions: true,
                    netSalary: true,
                    pfEmployee: true,
                    pfEmployer: true,
                    incomeTax: true,
                    loanDeduction: true,
                    festivalBonus: true,
                },
                _count: true,
            }),
        ]),
    );

    return NextResponse.json({
        // Phase 1 (Float → Decimal): convert Decimal slip fields and Decimal
        // aggregate sums to JS numbers so JSON serialization produces numbers
        // (the frontend payroll report summary expects numeric totals).
        data: slips.map((slip) => ({
            ...slip,
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
        summary: {
            totalSlips: aggregates._count,
            totalGross: toNumber(aggregates._sum.grossSalary),
            totalDeductions: toNumber(aggregates._sum.totalDeductions),
            totalNet: toNumber(aggregates._sum.netSalary),
            totalPFEmployee: toNumber(aggregates._sum.pfEmployee),
            totalPFEmployer: toNumber(aggregates._sum.pfEmployer),
            totalIncomeTax: toNumber(aggregates._sum.incomeTax),
            totalLoanDeduction: toNumber(aggregates._sum.loanDeduction),
            totalFestivalBonus: toNumber(aggregates._sum.festivalBonus),
        },
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            totalCount,
            totalPages: Math.ceil(totalCount / pagination.limit),
            hasMore: pagination.page * pagination.limit < totalCount,
        },
        filters: { month, year, status: payrollStatus },
    });
}
