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

const MINIMUM_TAX = 5000; // Minimum tax for Dhaka/Chittagong city corporation

// ============================================
// Tax Calculation
// ============================================

export function calculateAnnualTax(annualIncome: number, isWoman: boolean = false): number {
    const slabs = isWoman ? TAX_SLABS_WOMEN : TAX_SLABS;
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

    if (annualIncome > taxFreeThreshold && totalTax < MINIMUM_TAX) {
        totalTax = MINIMUM_TAX;
    }

    return Math.round(totalTax);
}

export function calculateMonthlyTax(annualIncome: number, isWoman: boolean = false): number {
    return Math.round(calculateAnnualTax(annualIncome, isWoman) / 12);
}

// ============================================
// Overtime Calculation (Bangladesh Labor Law)
// ============================================

/**
 * Overtime rate: 2x basic salary per hour (Section 108, Bangladesh Labor Act 2006)
 */
export function calculateOvertime(overtimeMinutes: number, monthlyBasicSalary: number): number {
    if (overtimeMinutes <= 0 || monthlyBasicSalary <= 0) return 0;
    // IEEE 754 FIX: multiply first, divide last to maximize integer precision.
    // Formula: (OT_minutes / 60) × (basic / (26 × 8)) × 2
    // Rewritten: (basic × 2 × OT_minutes) / (26 × 8 × 60) = (basic × OT_minutes) / 6240
    return Math.round((monthlyBasicSalary * 2 * overtimeMinutes) / (26 * 8 * 60));
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
    } = input;

    // Get employee's active salary structure assignment
    const assignment = await prisma.salaryStructureAssignment.findFirst({
        where: {
            employeeId,
            isActive: true,
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
    });

    if (!assignment) {
        throw new Error(`No active salary structure found for employee ${employeeId}`);
    }

    const structure = assignment.salaryStructure;
    const grossSalaryMonthly = assignment.grossSalary;
    const organizationId = assignment.employee?.organizationId || "";

    // Calculate salary components based on structure percentages
    const basicSalary = Math.round(grossSalaryMonthly * (structure.basicPercentage / 100));
    const houseRent = Math.round(basicSalary * (structure.houseRentPercent / 100));
    const medicalAllowance = Math.round(basicSalary * (structure.medicalPercent / 100));
    const conveyance = structure.conveyanceFixed;
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

    // Get approved leaves for the month
    const leaveRecords = await prisma.leaveApplication.findMany({
        where: {
            employeeId,
            status: "approved",
            fromDate: { lte: endDate },
            toDate: { gte: startDate },
        },
    });

    // Calculate working days (exclude weekends — Friday/Saturday for Bangladesh)
    let totalWorkingDays = 0;
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const day = currentDate.getDay();
        if (day !== 5 && day !== 6) { // Skip Friday (5) and Saturday (6)
            totalWorkingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    const presentDays = attendanceRecords.filter(a =>
        a.status === "present" || a.status === "half_day"
    ).length;

    const leaveDays = leaveRecords.reduce((sum, l) => sum + l.totalDays, 0);
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
        ? Math.round(basicSalary * (structure.pfEmployeePercent / 100))
        : 0;
    const pfEmployer = assignment.employee?.pfEnabled
        ? Math.round(basicSalary * (structure.pfEmployerPercent / 100))
        : 0;

    // Gender-aware tax
    const annualGross = grossSalaryMonthly * 12;
    const annualPF = pfEmployee * 12;
    const taxableIncome = annualGross - annualPF;
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
    const loanDeduction = activeLoans.reduce((sum, loan) => sum + loan.emiAmount, 0);

    // Calculate totals
    const grossEarnings = basicSalary + houseRent + medicalAllowance + conveyance +
        specialAllowance + overtimeAmount + bonus + festivalBonus + arrears + otherEarnings;

    const totalDeductions = pfEmployee + incomeTax + loanDeduction + absentDeduction +
        lateDeduction + otherDeductions;

    const netSalary = grossEarnings - totalDeductions;

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
