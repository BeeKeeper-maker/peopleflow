/**
 * PeopleFlow Payroll Calculation Engine v2
 *
 * Core module for automatic salary computation with full BLA 2006 compliance.
 *
 * v2 Upgrades:
 *   ✅ Festival Bonus: Auto-includes pending Eid/Puja bonuses from FestivalBonusPayment
 *   ✅ Tiered Late Deduction: Configurable severity tiers replace flat "3 lates = 1 day"
 *   ✅ PF Ledger Integration: Auto-posts monthly contributions to double-entry ledger
 *   ✅ Gender-aware tax calculation (women get BDT 50,000 higher threshold)
 *   ✅ Gratuity per Section 27, BLA 2006 (30 days × years of completed service)
 *   ✅ Division-by-zero guards
 *   ✅ CSV injection protection in bank file generation
 *
 * Calculation Pipeline:
 *   1. Load salary structure + attendance data
 *   2. Calculate base salary components
 *   3. Calculate overtime (2x rate per BLA 2006 Section 108)
 *   4. Fetch pending festival bonuses
 *   5. Calculate tiered late deductions (or legacy fallback)
 *   6. Calculate PF deductions
 *   7. Calculate income tax (gender-aware slabs)
 *   8. Aggregate net salary
 *   9. Post PF contributions to ledger (if enabled)
 */

import prisma from "@/lib/prisma";
import { getFestivalBonusForPayroll } from "@/lib/festival-bonus-engine";
import { calculateLateDeduction, type LateDeductionResult } from "@/lib/late-deduction-engine";
import { recordMonthlyContributions } from "@/lib/pf-ledger-engine";
import { payrollLogger } from "@/lib/logger";

// ============================================
// Decimal → Number coercion helper (Phase 1: Float → Decimal migration)
// ============================================

/**
 * Convert a Prisma Decimal value (or any value) to a JavaScript number.
 *
 * Why this exists:
 *   SalarySlip monetary fields were migrated from Float → Decimal(18,2) for
 *   BDT poisha precision. Prisma now returns `Prisma.Decimal` (decimal.js)
 *   objects instead of native numbers for those columns. decimal.js does
 *   NOT override the `+` operator (valueOf returns a string), so
 *   `decimal + decimal` silently produces string concatenation like
 *   "5000030000" instead of 80000. JSON.stringify also serializes Decimal
 *   to a string, breaking API consumers that expect numbers.
 *
 * Strategy:
 *   - Wrap every SalarySlip monetary/day-count field read with this helper.
 *   - All payroll arithmetic stays in JS numbers — IEEE-754 doubles have
 *     15+ significant digits, more than enough for BDT amounts at 2 dp.
 *   - Decimal precision is preserved at the DB layer for storage accuracy.
 *
 * @param value Decimal | number | string | null | undefined
 * @returns number (0 for null/undefined)
 */
export function toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    // Prisma.Decimal (decimal.js) — Number() calls valueOf() which returns
    // a numeric string, then coerces to a number. Works for any numeric
    // string ("50000", "50000.50", "-100.25") as well as Decimal objects.
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

// ============================================
// Bangladesh Income Tax Slabs (FY 2024-25)
// ============================================
const TAX_SLABS = [
    { upTo: 350000, rate: 0 },       // First 3,50,000 — Nil
    { upTo: 450000, rate: 0.05 },    // Next 1,00,000 — 5%
    { upTo: 750000, rate: 0.10 },    // Next 3,00,000 — 10%
    { upTo: 1150000, rate: 0.15 },   // Next 4,00,000 — 15%
    { upTo: 1650000, rate: 0.20 },   // Next 5,00,000 — 20%
    { upTo: Infinity, rate: 0.25 },  // Remaining — 25%
];

// Women get 50,000 higher tax-free threshold
const TAX_SLABS_WOMEN = [
    { upTo: 400000, rate: 0 },       // First 4,00,000 — Nil (50k more)
    { upTo: 500000, rate: 0.05 },    // Next 1,00,000 — 5%
    { upTo: 800000, rate: 0.10 },    // Next 3,00,000 — 10%
    { upTo: 1200000, rate: 0.15 },   // Next 4,00,000 — 15%
    { upTo: 1700000, rate: 0.20 },   // Next 5,00,000 — 20%
    { upTo: Infinity, rate: 0.25 },  // Remaining — 25%
];

// Senior citizens (65+) get 50,000 higher threshold (same as women)
const TAX_SLABS_SENIOR = TAX_SLABS_WOMEN;

// Disabled persons get 100,000 higher threshold
const TAX_SLABS_DISABLED = [
    { upTo: 450000, rate: 0 },       // First 4,50,000 — Nil (100k more)
    { upTo: 550000, rate: 0.05 },    // Next 1,00,000 — 5%
    { upTo: 850000, rate: 0.10 },    // Next 3,00,000 — 10%
    { upTo: 1250000, rate: 0.15 },   // Next 4,00,000 — 15%
    { upTo: 1750000, rate: 0.20 },   // Next 5,00,000 — 20%
    { upTo: Infinity, rate: 0.25 },  // Remaining — 25%
];

// Gazette-recognized freedom fighters get 150,000 higher threshold
const TAX_SLABS_FREEDOM_FIGHTER = [
    { upTo: 500000, rate: 0 },       // First 5,00,000 — Nil (150k more)
    { upTo: 600000, rate: 0.05 },    // Next 1,00,000 — 5%
    { upTo: 900000, rate: 0.10 },    // Next 3,00,000 — 10%
    { upTo: 1300000, rate: 0.15 },   // Next 4,00,000 — 15%
    { upTo: 1800000, rate: 0.20 },   // Next 5,00,000 — 20%
    { upTo: Infinity, rate: 0.25 },  // Remaining — 25%
];

// Tiered minimum tax by area (BD Finance Act 2024)
const MINIMUM_TAX_DHAKA_CHITTAGONG = 5000;  // City corporations (Dhaka, Chittagong)
const MINIMUM_TAX_OTHER_CITY = 4000;         // Other city corporations
const MINIMUM_TAX_MUNICIPAL = 3000;          // Municipal areas

// Tax-exempt allowance limits (BD Finance Act 2024)
const TAX_EXEMPT_ALLOWANCES = {
    conveyance: 30000,    // ৳30,000/year
    medical: 120000,      // ৳1,20,000/year
    houseRent: 300000,    // ৳3,00,000/year (50% of basic or 3L, whichever is lower)
};

// ============================================
// Tax Calculation (with BD exemptions)
// ============================================

export interface TaxExemptionFlags {
    isWoman?: boolean;
    isSenior?: boolean;        // Age 65+
    isDisabled?: boolean;
    isFreedomFighter?: boolean;
    area?: "dhaka_chittagong" | "other_city" | "municipal" | "rural";
}

export function calculateAnnualTax(
    annualIncome: number,
    isWoman: boolean = false,
    exemptions?: TaxExemptionFlags
): number {
    // Determine which slab to use based on exemptions
    let slabs = TAX_SLABS;

    if (exemptions?.isFreedomFighter) {
        slabs = TAX_SLABS_FREEDOM_FIGHTER;
    } else if (exemptions?.isDisabled) {
        slabs = TAX_SLABS_DISABLED;
    } else if (exemptions?.isSenior) {
        slabs = TAX_SLABS_SENIOR;
    } else if (isWoman || exemptions?.isWoman) {
        slabs = TAX_SLABS_WOMEN;
    }

    const taxFreeThreshold = slabs[0].upTo;

    let remainingIncome = annualIncome;
    let totalTax = 0;
    let previousUpTo = 0;

    for (const slab of slabs) {
        if (remainingIncome <= 0) break;
        const slabRange = slab.upTo - previousUpTo;
        const taxableInSlab = Math.min(remainingIncome, slabRange);
        totalTax += taxableInSlab * slab.rate;
        remainingIncome -= taxableInSlab;
        previousUpTo = slab.upTo;
    }

    // Apply tiered minimum tax based on area
    if (annualIncome > taxFreeThreshold) {
        const area = exemptions?.area || "dhaka_chittagong";
        let minTax = MINIMUM_TAX_DHAKA_CHITTAGONG;
        if (area === "other_city") minTax = MINIMUM_TAX_OTHER_CITY;
        else if (area === "municipal") minTax = MINIMUM_TAX_MUNICIPAL;
        else if (area === "rural") minTax = 0; // No minimum tax in rural areas

        if (minTax > 0 && totalTax < minTax) {
            totalTax = minTax;
        }
    }

    return Math.round(totalTax);
}

export function calculateMonthlyTax(
    annualIncome: number,
    isWoman: boolean = false,
    exemptions?: TaxExemptionFlags
): number {
    return Math.round(calculateAnnualTax(annualIncome, isWoman, exemptions) / 12);
}

// ============================================
// Overtime Calculation (Bangladesh Labor Law)
// ============================================

/**
 * Maximum overtime per day: 2 hours (BLA 2006 Section 108)
 * Maximum overtime per week: not explicitly limited, but total work
 *   hours (including OT) must not exceed 10 hours/day, 60 hours/week.
 * Overtime rate: 2x basic salary per hour (Section 108)
 *
 * Formula: (basic / (26 days × 8 hours)) × 2 × OT_hours
 *        = (basic × OT_minutes) / 6240
 */
const MAX_OT_HOURS_PER_DAY = 2;
const MAX_OT_HOURS_PER_WEEK = 12; // Industry practice (not explicit in BLA)

export function calculateOvertime(overtimeMinutes: number, monthlyBasicSalary: number): number {
    if (overtimeMinutes <= 0 || monthlyBasicSalary <= 0) return 0;
    // IEEE 754 FIX: multiply first, divide last to maximize integer precision.
    // Formula: (OT_minutes / 60) × (basic / (26 × 8)) × 2
    // Rewritten: (basic × 2 × OT_minutes) / (26 × 8 × 60) = (basic × OT_minutes) / 6240
    return Math.round((monthlyBasicSalary * 2 * overtimeMinutes) / (26 * 8 * 60));
}

/**
 * Validate overtime against BLA 2006 limits.
 * Returns warnings if OT exceeds legal limits.
 */
export function validateOvertime(
    dailyOvertimeMinutes: number,
    weeklyOvertimeMinutes: number
): { warnings: string[]; isCompliant: boolean } {
    const warnings: string[] = [];
    const dailyOTHours = dailyOvertimeMinutes / 60;
    const weeklyOTHours = weeklyOvertimeMinutes / 60;

    if (dailyOTHours > MAX_OT_HOURS_PER_DAY) {
        warnings.push(
            `Daily overtime ${dailyOTHours.toFixed(1)} hours exceeds BLA limit of ${MAX_OT_HOURS_PER_DAY} hours/day (Section 108)`
        );
    }

    if (weeklyOTHours > MAX_OT_HOURS_PER_WEEK) {
        warnings.push(
            `Weekly overtime ${weeklyOTHours.toFixed(1)} hours exceeds recommended limit of ${MAX_OT_HOURS_PER_WEEK} hours/week`
        );
    }

    return {
        warnings,
        isCompliant: warnings.length === 0,
    };
}

// ============================================
// Gratuity Calculation
// ============================================

/**
 * Gratuity per Section 27, Bangladesh Labor Act 2006:
 * "30 days' wages for each completed year of service"
 *
 * Formula: (lastBasicSalary / 26) × 30 × yearsOfService
 * Eligible after 5 years of continuous service.
 */
export function calculateGratuity(lastBasicSalary: number, yearsOfService: number): number {
    if (yearsOfService < 5) return 0;
    // IEEE 754 FIX: multiply first, divide last.
    // Formula: (basic / 26) × 30 × years → (basic × 30 × years) / 26
    return Math.round((lastBasicSalary * 30 * yearsOfService) / 26);
}


function isBangladeshWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 5 || day === 6; // Friday/Saturday weekend
}

function startOfLocalDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
}

function countWorkingDays(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = startOfLocalDay(startDate);
    const finalDate = startOfLocalDay(endDate);

    while (currentDate <= finalDate) {
        if (!isBangladeshWeekend(currentDate)) workingDays++;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
}

function countLeaveDaysInPayrollPeriod(
    leave: { fromDate: Date; toDate: Date; totalDays: number; halfDay?: boolean | null },
    periodStart: Date,
    periodEnd: Date
): number {
    const leaveStart = startOfLocalDay(leave.fromDate);
    const leaveEnd = startOfLocalDay(leave.toDate);
    const start = leaveStart > startOfLocalDay(periodStart) ? leaveStart : startOfLocalDay(periodStart);
    const end = leaveEnd < startOfLocalDay(periodEnd) ? leaveEnd : startOfLocalDay(periodEnd);

    if (start > end) return 0;

    if (leave.halfDay) {
        return start.getTime() === end.getTime() && !isBangladeshWeekend(start) ? 0.5 : 0;
    }

    return countWorkingDays(start, end);
}

// ============================================
// Salary Calculation Engine v2
// ============================================

interface SalaryBreakdown {
    // Working days
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    leaveDays: number;

    // Earnings
    basicSalary: number;
    houseRent: number;
    medicalAllowance: number;
    conveyance: number;
    specialAllowance: number;
    overtime: number;
    bonus: number;           // ad-hoc bonus
    festivalBonus: number;   // ✅ NEW: Festival bonus (Eid, Puja, etc.)
    arrears: number;
    otherEarnings: number;
    grossSalary: number;

    // Deductions
    pfEmployee: number;
    pfEmployer: number;
    incomeTax: number;
    loanDeduction: number;
    absentDeduction: number;
    lateDeduction: number;
    otherDeductions: number;
    totalDeductions: number;

    // Late deduction detail (for audit trail)
    lateDeductionDetail: LateDeductionResult;

    // Net
    netSalary: number;
}

interface CalculateSalaryInput {
    employeeId: string;
    month: number; // 1-12
    year: number;
    bonus?: number;          // ad-hoc bonus
    arrears?: number;
    otherEarnings?: number;
    otherDeductions?: number;
    postPFContributions?: boolean; // If true, auto-post PF to ledger (default: true)
    includeInactiveAssignment?: boolean; // Explicit final-settlement payroll after offboarding
}

export async function calculateSalary(input: CalculateSalaryInput): Promise<SalaryBreakdown> {
    const {
        employeeId,
        month,
        year,
        bonus = 0,
        arrears = 0,
        otherEarnings = 0,
        otherDeductions = 0,
        postPFContributions = true,
        includeInactiveAssignment = false,
    } = input;

    // Get employee's salary structure assignment for the payroll period.
    // Normal payroll uses active assignments only. Explicit final-settlement payroll
    // may include inactive assignments so HR can pay a terminated/offboarded employee
    // for an unprocessed month without restoring ESS access.
    const assignment = await prisma.salaryStructureAssignment.findFirst({
        where: {
            employeeId,
            ...(includeInactiveAssignment ? {} : { isActive: true }),
            effectiveFrom: { lte: new Date(year, month - 1, 28) },
            OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date(year, month - 1, 1) } },
            ],
        },
        include: {
            salaryStructure: true,
            employee: {
                select: {
                    gender: true,
                    organizationId: true,
                    pfEnabled: true,
                },
            },
        },
        orderBy: { effectiveFrom: "desc" },
    });

    if (!assignment) {
        throw new Error(`No active salary structure found for employee ${employeeId}`);
    }

    const structure = assignment.salaryStructure;
    const grossSalaryMonthly = Number(assignment.grossSalary);
    const organizationId = assignment.employee?.organizationId || "";

    // Calculate salary components based on structure percentages
    const basicSalary = Math.round(grossSalaryMonthly * (Number(structure.basicPercentage) / 100));
    const houseRent = Math.round(basicSalary * (Number(structure.houseRentPercent) / 100));
    const medicalAllowance = Math.round(basicSalary * (Number(structure.medicalPercent) / 100));
    const conveyance = Number(structure.conveyanceFixed);
    const specialAllowance = Math.max(0,
        grossSalaryMonthly - basicSalary - houseRent - medicalAllowance - conveyance
    );

    // Get attendance data for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    const attendanceRecords = await prisma.attendance.findMany({
        where: {
            employeeId,
            date: { gte: startDate, lte: endDate },
        },
    });

    // Get approved leaves that overlap this payroll month. The month-specific
    // payable leave days are calculated below; using application.totalDays directly
    // would over-count cross-month leaves (e.g. Mar 30–Apr 2 in April payroll).
    const leaveRecords = await prisma.leaveApplication.findMany({
        where: {
            employeeId,
            status: "approved",
            fromDate: { lte: endDate },
            toDate: { gte: startDate },
        },
    });

    const totalWorkingDays = countWorkingDays(startDate, endDate);

    const presentDays = attendanceRecords.reduce((sum, attendance) => {
        if (attendance.status === "present" || attendance.status === "late") return sum + 1;
        if (attendance.status === "half_day") return sum + 0.5;
        return sum;
    }, 0);

    const leaveDays = leaveRecords.reduce((sum, leave) => {
        return sum + countLeaveDaysInPayrollPeriod(leave, startDate, endDate);
    }, 0);
    const absentDays = Math.max(0, totalWorkingDays - presentDays - leaveDays);

    // Calculate overtime
    const totalOvertimeMinutes = attendanceRecords.reduce((sum, a) => sum + a.overtimeMinutes, 0);
    const overtimeAmount = calculateOvertime(totalOvertimeMinutes, basicSalary);

    // ✅ NEW: Fetch pending festival bonuses (auto-includes Eid/Puja bonuses)
    const festivalBonus = await getFestivalBonusForPayroll(employeeId, month, year);

    // Division-by-zero guard
    const perDaySalary = totalWorkingDays > 0 ? grossSalaryMonthly / totalWorkingDays : 0;
    const absentDeduction = Math.round(absentDays * perDaySalary);

    // ✅ NEW: Tiered late deduction calculation (replaces flat "3 lates = 1 day")
    const lateDeductionResult = await calculateLateDeduction(
        organizationId,
        employeeId,
        month,
        year,
        perDaySalary
    );
    const lateDeduction = lateDeductionResult.deductionAmount;

    // PF deduction
    const pfEmployee = assignment.employee?.pfEnabled
        ? Math.round(basicSalary * (Number(structure.pfEmployeePercent) / 100))
        : 0;
    const pfEmployer = assignment.employee?.pfEnabled
        ? Math.round(basicSalary * (Number(structure.pfEmployerPercent) / 100))
        : 0;

    // Gender-aware tax with BD tax-exempt allowances (BD Finance Act 2024)
    // Per the BD Finance Act, certain allowances are exempt from income tax
    // up to annual caps: conveyance (৳30k), medical (৳1.2L), house rent (৳3L).
    // Without this exemption, employees with these allowances are over-taxed.
    const annualGross = grossSalaryMonthly * 12;
    const annualPF = pfEmployee * 12;

    // Calculate tax-exempt portion of each allowance (monthly × 12, capped at annual exempt limit)
    const annualConveyance = Math.min((conveyance || 0) * 12, TAX_EXEMPT_ALLOWANCES.conveyance);
    const annualMedical = Math.min((medicalAllowance || 0) * 12, TAX_EXEMPT_ALLOWANCES.medical);
    const annualHouseRent = Math.min((houseRent || 0) * 12, TAX_EXEMPT_ALLOWANCES.houseRent);

    const totalExempt = annualConveyance + annualMedical + annualHouseRent;
    // Guard against negative taxable income (e.g. when PF + exemptions exceed gross)
    const taxableIncome = Math.max(0, annualGross - annualPF - totalExempt);

    const isWoman = assignment.employee?.gender === "female";
    const incomeTax = calculateMonthlyTax(taxableIncome, isWoman);

    // Loan deductions
    const activeLoans = await prisma.loan.findMany({
        where: {
            employeeId,
            status: "disbursed",
            remainingAmount: { gt: 0 },
        },
    });
    const loanDeduction = activeLoans.reduce((sum, loan) => sum + Number(loan.emiAmount), 0);

    // Calculate totals
    const grossEarnings = basicSalary + houseRent + medicalAllowance + conveyance +
        specialAllowance + overtimeAmount + bonus + festivalBonus + arrears + otherEarnings;

    const totalDeductions = pfEmployee + incomeTax + loanDeduction + absentDeduction +
        lateDeduction + otherDeductions;

    // Payroll slips should never show a negative payable salary. If deductions exceed
    // earnings (e.g. no attendance data for a processed month), cap payable net at 0;
    // future payable adjustments/arrears should be handled explicitly, not as a negative payslip.
    const netSalary = Math.max(0, grossEarnings - totalDeductions);

    // ✅ NEW: Auto-post PF contributions to the PF Ledger
    if (postPFContributions && pfEmployee > 0 && assignment.employee?.pfEnabled) {
        try {
            await recordMonthlyContributions({
                employeeId,
                month,
                year,
                employeeAmount: pfEmployee,
                employerAmount: pfEmployer,
            });
        } catch (pfError) {
            // PF posting failure should NOT block salary calculation
            payrollLogger.error({ err: pfError, employeeId }, "Failed to post PF contribution");
        }
    }

    return {
        totalWorkingDays,
        presentDays,
        absentDays,
        leaveDays,
        basicSalary,
        houseRent,
        medicalAllowance,
        conveyance,
        specialAllowance,
        overtime: overtimeAmount,
        bonus,
        festivalBonus,
        arrears,
        otherEarnings,
        grossSalary: grossEarnings,
        pfEmployee,
        pfEmployer,
        incomeTax,
        loanDeduction,
        absentDeduction,
        lateDeduction,
        otherDeductions,
        totalDeductions,
        lateDeductionDetail: lateDeductionResult,
        netSalary,
    };
}

// ============================================
// Bank File Generation
// ============================================

interface BankFileEntry {
    employeeName: string;
    employeeId: string;
    bankAccountNumber: string;
    bankName: string;
    branchName: string;
    routingNumber: string;
    amount: number;
}

// CSV injection protection — escape values that could be interpreted as formulas
function escapeCsvValue(value: string | number): string {
    const str = String(value);
    // Escape values starting with formula characters
    if (/^[=+\-@\t\r]/.test(str)) {
        return `'${str}`;
    }
    // Quote values containing commas, quotes, or newlines
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function generateBankFileCSV(entries: BankFileEntry[], month: number, year: number): string {
    const headers = [
        "SL No.",
        "Employee ID",
        "Employee Name",
        "Bank Name",
        "Branch Name",
        "Account Number",
        "Routing Number",
        "Amount (BDT)",
    ];

    const rows = entries.map((entry, index) => [
        index + 1,
        escapeCsvValue(entry.employeeId),
        escapeCsvValue(entry.employeeName),
        escapeCsvValue(entry.bankName),
        escapeCsvValue(entry.branchName),
        escapeCsvValue(entry.bankAccountNumber),
        escapeCsvValue(entry.routingNumber),
        entry.amount.toFixed(2),
    ]);

    const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

    const csvLines = [
        `Salary Payment - ${getMonthName(month)} ${year}`,
        "",
        headers.join(","),
        ...rows.map(row => row.join(",")),
        "",
        `Total,,,,,,,${totalAmount.toFixed(2)}`,
        `Total Employees: ${entries.length}`,
    ];

    return csvLines.join("\n");
}

function getMonthName(month: number): string {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];
    return months[month - 1] || "";
}
