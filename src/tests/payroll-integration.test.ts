/**
 * ═══════════════════════════════════════════════════════════════════
 * PAYROLL ENGINE — FULL INTEGRATION TEST SUITE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests the async `calculateSalary()` pipeline end-to-end with
 * comprehensive Prisma mock injection. Every DB call is intercepted
 * and controlled to achieve 100% branch + statement coverage.
 *
 * Mock Architecture:
 *   - prisma.salaryStructureAssignment.findFirst → salary structure
 *   - prisma.attendance.findMany → attendance records
 *   - prisma.leaveApplication.findMany → approved leaves
 *   - prisma.loan.findMany → active disbursed loans
 *   - getFestivalBonusForPayroll → festival bonus module (mocked)
 *   - calculateLateDeduction → late deduction module (mocked)
 *   - recordMonthlyContributions → PF ledger module (mocked)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependent modules BEFORE importing calculateSalary ─────────
vi.mock("@/lib/festival-bonus-engine", () => ({
    getFestivalBonusForPayroll: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/late-deduction-engine", () => ({
    calculateLateDeduction: vi.fn().mockResolvedValue({
        totalLateCount: 0,
        deductionAmount: 0,
        warnings: [],
        tierBreakdown: [],
    }),
}));

vi.mock("@/lib/pf-ledger-engine", () => ({
    recordMonthlyContributions: vi.fn().mockResolvedValue({
        success: true,
        pfAccountId: "pf-001",
        employeeContribution: 0,
        employerContribution: 0,
        newEmployeeBalance: 0,
        newEmployerBalance: 0,
        newTotalBalance: 0,
    }),
}));

import { calculateSalary } from "@/lib/payroll-engine";
import prisma from "@/lib/prisma";
import { getFestivalBonusForPayroll } from "@/lib/festival-bonus-engine";
import { calculateLateDeduction } from "@/lib/late-deduction-engine";
import { recordMonthlyContributions } from "@/lib/pf-ledger-engine";

// ── Test Fixtures ───────────────────────────────────────────────────

const MOCK_SALARY_STRUCTURE = {
    id: "struct-001",
    name: "Standard",
    basicPercentage: 50,
    houseRentPercent: 50,    // 50% of basic
    medicalPercent: 10,      // 10% of basic
    conveyanceFixed: 2500,
    pfEmployeePercent: 10,
    pfEmployerPercent: 10,
};

function buildMockAssignment(overrides: Record<string, unknown> = {}) {
    return {
        id: "assign-001",
        employeeId: "emp-001",
        grossSalary: 50_000,
        isActive: true,
        effectiveFrom: new Date(2025, 0, 1),
        effectiveTo: null,
        salaryStructure: MOCK_SALARY_STRUCTURE,
        employee: {
            gender: "male",
            organizationId: "org-001",
            pfEnabled: true,
        },
        ...overrides,
    };
}

// Build a full month of "present" attendance (April 2026 = 22 working days)
function buildAttendanceRecords(count: number, overtimeMinutes = 0) {
    return Array.from({ length: count }, (_, i) => ({
        id: `att-${i}`,
        employeeId: "emp-001",
        date: new Date(2026, 3, i + 1),
        status: "present",
        overtimeMinutes,
        lateMinutes: 0,
    }));
}

// ═══════════════════════════════════════════════════════════════════
// FULL SALARY CALCULATION PIPELINE
// ═══════════════════════════════════════════════════════════════════

describe("calculateSalary() — Full Pipeline", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws when no salary structure is assigned", async () => {
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(null);

        await expect(
            calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 })
        ).rejects.toThrow("No active salary structure found");
    });

    it("calculates a complete salary for a standard male employee", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);
        vi.mocked(getFestivalBonusForPayroll).mockResolvedValue(0);
        vi.mocked(calculateLateDeduction).mockResolvedValue({
            totalLateCount: 0, deductionAmount: 0, warnings: [], tierBreakdown: [],
        });

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // Gross = 50,000
        // Basic = 50,000 × 50% = 25,000
        // HRA = 25,000 × 50% = 12,500
        // Medical = 25,000 × 10% = 2,500
        // Conveyance = 2,500
        // Special = 50,000 - 25,000 - 12,500 - 2,500 - 2,500 = 7,500
        expect(result.basicSalary).toBe(25_000);
        expect(result.houseRent).toBe(12_500);
        expect(result.medicalAllowance).toBe(2_500);
        expect(result.conveyance).toBe(2_500);
        expect(result.specialAllowance).toBe(7_500);

        // PF = basic × 10% = 2,500
        expect(result.pfEmployee).toBe(2_500);
        expect(result.pfEmployer).toBe(2_500);

        // Attendance: 22 present, 0 absent, 0 leave
        expect(result.presentDays).toBe(22);
        expect(result.absentDays).toBe(0);
        expect(result.leaveDays).toBe(0);

        // Net must be positive
        expect(result.netSalary).toBeGreaterThan(0);
        expect(Number.isInteger(result.netSalary)).toBe(true);

        // Verify PF posting was called
        expect(recordMonthlyContributions).toHaveBeenCalledWith({
            employeeId: "emp-001",
            month: 4,
            year: 2026,
            employeeAmount: 2_500,
            employerAmount: 2_500,
        });
    });

    it("applies absent deduction correctly", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        // Only 18 present out of 22 working days → 4 absent
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(18) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        expect(result.presentDays).toBe(18);
        expect(result.absentDays).toBe(4);
        // Absent deduction = 4 × (50,000 / 22) ≈ 9,091
        expect(result.absentDeduction).toBe(Math.round(4 * (50_000 / 22)));
        expect(result.absentDeduction).toBeGreaterThan(0);
    });

    it("counts approved leaves and reduces absent count", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(19) as never);
        // 2 days of approved leave
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([
            { id: "lv-1", totalDays: 2, status: "approved", fromDate: new Date(2026, 3, 6), toDate: new Date(2026, 3, 7), halfDay: false },
        ] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        expect(result.presentDays).toBe(19);
        expect(result.leaveDays).toBe(2);
        // 22 working - 19 present - 2 leave = MAX(0, 1) = 1 absent
        expect(result.absentDays).toBe(1);
    });

    it("counts only the payroll-month portion of cross-month approved leave", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(20) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([
            { id: "lv-cross", totalDays: 4, status: "approved", fromDate: new Date(2026, 2, 30), toDate: new Date(2026, 3, 2), halfDay: false },
        ] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        expect(result.leaveDays).toBe(2);
        expect(result.absentDays).toBe(0);
    });

    it("treats late attendance as present so salary is not double-penalized", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue([
            ...buildAttendanceRecords(21),
            { id: "att-late", employeeId: "emp-001", date: new Date(2026, 3, 30), status: "late", overtimeMinutes: 0, lateMinutes: 15 },
        ] as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);
        vi.mocked(calculateLateDeduction).mockResolvedValue({
            totalLateCount: 1, deductionAmount: 250, warnings: [], tierBreakdown: [],
        });

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        expect(result.presentDays).toBe(22);
        expect(result.absentDays).toBe(0);
        expect(result.lateDeduction).toBe(250);
    });

    it("supports half-day leave/attendance as fractional payroll days", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue([
            ...buildAttendanceRecords(21),
            { id: "att-half", employeeId: "emp-001", date: new Date(2026, 3, 30), status: "half_day", overtimeMinutes: 0, lateMinutes: 0 },
        ] as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([
            { id: "lv-half", totalDays: 0.5, status: "approved", fromDate: new Date(2026, 3, 30), toDate: new Date(2026, 3, 30), halfDay: true },
        ] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        expect(result.presentDays).toBe(21.5);
        expect(result.leaveDays).toBe(0.5);
        expect(result.absentDays).toBe(0);
    });

    it("includes overtime in gross earnings", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        // Each day has 60 min OT → 22 × 60 = 1320 total OT minutes
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22, 60) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // OT = (25,000 × 2 × 1320) / (26 × 8 × 60) = 66,000,000 / 12,480 = 5,288 (rounded)
        expect(result.overtime).toBe(Math.round((25_000 * 2 * 1320) / (26 * 8 * 60)));
        expect(result.overtime).toBeGreaterThan(5000);
    });

    it("includes festival bonus from the bonus engine", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);
        // Festival bonus of 25,000 (Eid)
        vi.mocked(getFestivalBonusForPayroll).mockResolvedValue(25_000);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        expect(result.festivalBonus).toBe(25_000);
        expect(result.grossSalary).toBeGreaterThanOrEqual(75_000); // 50k salary + 25k bonus
    });

    it("deducts loan EMI from net salary", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([
            { id: "loan-1", status: "disbursed", remainingAmount: 100_000, emiAmount: 5_000 },
            { id: "loan-2", status: "disbursed", remainingAmount: 50_000, emiAmount: 2_500 },
        ] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        expect(result.loanDeduction).toBe(7_500);
    });

    it("applies late deduction from the late deduction engine", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);
        vi.mocked(calculateLateDeduction).mockResolvedValue({
            totalLateCount: 5,
            deductionAmount: 3_500,
            warnings: [{ tierName: "Tier 2", warningLevel: "verbal", message: "Late warning" }],
            tierBreakdown: [{ tierName: "Tier 2", tierOrder: 2, lateCountInTier: 5, deductionPerLate: 700, totalDeduction: 3_500, deductionType: "half_day" }],
        });

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        expect(result.lateDeduction).toBe(3_500);
        expect(result.lateDeductionDetail.totalLateCount).toBe(5);
        expect(result.lateDeductionDetail.warnings).toHaveLength(1);
    });

    it("calculates gender-aware tax (female gets higher threshold)", async () => {
        const maleAssignment = buildMockAssignment();
        const femaleAssignment = buildMockAssignment({
            employee: { gender: "female", organizationId: "org-001", pfEnabled: true },
        });

        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        // Male
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(maleAssignment as never);
        const maleResult = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // Female
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(femaleAssignment as never);
        const femaleResult = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // Female should pay less or equal tax
        expect(femaleResult.incomeTax).toBeLessThanOrEqual(maleResult.incomeTax);
    });

    it("skips PF posting when pfEnabled is false", async () => {
        const assignment = buildMockAssignment({
            employee: { gender: "male", organizationId: "org-001", pfEnabled: false },
        });
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        expect(result.pfEmployee).toBe(0);
        expect(result.pfEmployer).toBe(0);
        expect(recordMonthlyContributions).not.toHaveBeenCalled();
    });

    it("skips PF posting when postPFContributions is false", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        await calculateSalary({
            employeeId: "emp-001", month: 4, year: 2026,
            postPFContributions: false,
        });

        expect(recordMonthlyContributions).not.toHaveBeenCalled();
    });

    it("continues salary calc even if PF posting fails", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);
        // PF posting throws
        vi.mocked(recordMonthlyContributions).mockRejectedValue(new Error("PF ledger down"));

        // Should NOT throw — salary still returns
        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });
        expect(result.netSalary).toBeGreaterThan(0);
    });

    it("includes ad-hoc bonus, arrears, and otherEarnings", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({
            employeeId: "emp-001", month: 4, year: 2026,
            bonus: 10_000,
            arrears: 5_000,
            otherEarnings: 3_000,
            otherDeductions: 1_000,
        });

        expect(result.bonus).toBe(10_000);
        expect(result.arrears).toBe(5_000);
        expect(result.otherEarnings).toBe(3_000);
        expect(result.otherDeductions).toBe(1_000);
    });

    it("handles zero-attendance month (guard against division by zero)", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        // February on a year where all working days are 0 (impossible but tests the guard)
        vi.mocked(prisma.attendance.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // Should not crash — absent deduction uses the guard
        expect(Number.isFinite(result.netSalary)).toBe(true);
    });

    it("computes correct net salary: gross - deductions", async () => {
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        const expectedGross = result.basicSalary + result.houseRent + result.medicalAllowance +
            result.conveyance + result.specialAllowance + result.overtime + result.bonus +
            result.festivalBonus + result.arrears + result.otherEarnings;

        const expectedDeductions = result.pfEmployee + result.incomeTax + result.loanDeduction +
            result.absentDeduction + result.lateDeduction + result.otherDeductions;

        expect(result.grossSalary).toBe(expectedGross);
        expect(result.totalDeductions).toBe(expectedDeductions);
        expect(result.netSalary).toBe(expectedGross - expectedDeductions);
    });

    it("all monetary values are integers (no fractional taka)", async () => {
        const assignment = buildMockAssignment({ grossSalary: 33_333 });
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22, 37) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([
            { id: "l1", status: "disbursed", remainingAmount: 10000, emiAmount: 1111 },
        ] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // Every monetary field must be an integer
        const monetaryFields = [
            result.basicSalary, result.houseRent, result.medicalAllowance,
            result.conveyance, result.specialAllowance, result.overtime,
            result.pfEmployee, result.pfEmployer, result.incomeTax,
            result.absentDeduction, result.lateDeduction, result.totalDeductions,
            result.netSalary,
        ];

        for (const val of monetaryFields) {
            expect(Number.isInteger(val)).toBe(true);
        }
    });
});
