/**
 * PeopleFlow Payroll Calculation Engine
 * 
 * Core module for automatic salary computation, tax calculation (Bangladesh),
 * overtime, gratuity, and bank file generation.
 * 
 * ✅ Audit fixes applied:
 *  - Gratuity formula corrected to 30 days × years (Section 27, BLA 2006)
 *  - Gender-aware tax calculation from Employee.gender field
 *  - Women's tax slab cascade properly adjusted
 *  - Division-by-zero guard for totalWorkingDays
 *  - CSV injection protection in bank file generation
 *  - Minimum tax threshold uses adjusted (women's) slab
 *  - Unused variable removed
 */

import prisma from "@/lib/prisma";

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

// ✅ Women get 50,000 higher tax-free threshold
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
    // ✅ FIXED: Use properly cascaded women's slabs instead of splicing
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

    // ✅ Minimum tax uses gender-appropriate threshold
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
    const hourlyRate = monthlyBasicSalary / (26 * 8); // 26 working days, 8 hours
    const overtimeHours = overtimeMinutes / 60;
    return Math.round(overtimeHours * hourlyRate * 2); // 2x rate
}

// ============================================
// Gratuity Calculation
// ============================================

/**
 * ✅ FIXED: Gratuity per Section 27, Bangladesh Labor Act 2006:
 * "30 days' wages for each completed year of service"
 * 
 * Previous (WRONG): lastBasicSalary × yearsOfService
 * Corrected: (lastBasicSalary / 26) × 30 × yearsOfService
 * 
 * Eligible after 5 years of continuous service.
 */
export function calculateGratuity(lastBasicSalary: number, yearsOfService: number): number {
    if (yearsOfService < 5) return 0;
    const dailyWage = lastBasicSalary / 26; // 26 working days per month
    return Math.round(dailyWage * 30 * yearsOfService);
}

// ============================================
// Salary Calculation Engine
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
    bonus: number;
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

    // Net
    netSalary: number;
}

interface CalculateSalaryInput {
    employeeId: string;
    month: number; // 1-12
    year: number;
    bonus?: number;
    arrears?: number;
    otherEarnings?: number;
    otherDeductions?: number;
}

export async function calculateSalary(input: CalculateSalaryInput): Promise<SalaryBreakdown> {
    const { employeeId, month, year, bonus = 0, arrears = 0, otherEarnings = 0, otherDeductions = 0 } = input;

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
                },
            },
        },
    });

    if (!assignment) {
        throw new Error(`No active salary structure found for employee ${employeeId}`);
    }

    const structure = assignment.salaryStructure;
    const grossSalaryMonthly = assignment.grossSalary;

    // Calculate salary components based on structure percentages
    const basicSalary = Math.round(grossSalaryMonthly * (structure.basicPercentage / 100));
    const houseRent = Math.round(basicSalary * (structure.houseRentPercent / 100));
    const medicalAllowance = Math.round(basicSalary * (structure.medicalPercent / 100));
    const conveyance = structure.conveyanceFixed;
    const specialAllowance = grossSalaryMonthly - basicSalary - houseRent - medicalAllowance - conveyance;

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

    // ✅ FIXED: Division-by-zero guard
    const perDaySalary = totalWorkingDays > 0 ? grossSalaryMonthly / totalWorkingDays : 0;
    const absentDeduction = Math.round(absentDays * perDaySalary);

    // Late deduction: 3 lates = 1 day absent (common policy)
    const lateCount = attendanceRecords.filter(a => a.lateMinutes > 0).length;
    const lateDeduction = Math.round(Math.floor(lateCount / 3) * perDaySalary);

    // PF deduction
    const pfEmployee = Math.round(basicSalary * (structure.pfEmployeePercent / 100));
    const pfEmployer = Math.round(basicSalary * (structure.pfEmployerPercent / 100));

    // ✅ FIXED: Gender-aware tax - detect from Employee record
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
        specialAllowance + overtimeAmount + bonus + arrears + otherEarnings;

    const totalDeductions = pfEmployee + incomeTax + loanDeduction + absentDeduction +
        lateDeduction + otherDeductions;

    const netSalary = grossEarnings - totalDeductions;

    return {
        totalWorkingDays,
        presentDays,
        absentDays,
        leaveDays,
        basicSalary,
        houseRent,
        medicalAllowance,
        conveyance,
        specialAllowance: Math.max(0, specialAllowance),
        overtime: overtimeAmount,
        bonus,
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

// ✅ CSV injection protection — escape values that could be interpreted as formulas
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
