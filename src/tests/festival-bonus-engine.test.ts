/**
 * ═══════════════════════════════════════════════════════════════════
 * FESTIVAL BONUS ENGINE — EXHAUSTIVE TEST SUITE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests the full bonus generation pipeline with Prisma mocks:
 *   1. Config loading & status validation
 *   2. Eligibility filters (service days, probation, contractual)
 *   3. Pro-rata calculation for new joiners
 *   4. Bulk payment creation
 *   5. Payroll integration (getFestivalBonusForPayroll)
 *   6. Summary & reporting
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";

// Must mock date-fns since festival-bonus-engine imports it
vi.mock("date-fns", () => ({
    differenceInCalendarDays: vi.fn().mockReturnValue(200),
}));

import {
    generateFestivalBonus,
    getFestivalBonusForPayroll,
    getFestivalBonusSummary,
    listFestivalBonusConfigs,
} from "@/lib/festival-bonus-engine";
import { differenceInCalendarDays } from "date-fns";

// ── Test Fixtures ───────────────────────────────────────────────────

const MOCK_CONFIG = {
    id: "config-001",
    name: "Eid-ul-Fitr Bonus 2026",
    organizationId: "org-001",
    festivalType: "eid_ul_fitr",
    year: 2026,
    percentageOfBasis: 100,
    calculationBasis: "basic",
    minimumServiceDays: 90,
    includeProbation: false,
    includeContractual: false,
    proRataForNewJoinee: true,
    status: "draft",
    organization: { id: "org-001", name: "Test Corp" },
    payments: [],
};

const MOCK_EMPLOYEE = {
    id: "emp-001",
    firstName: "Rahim",
    lastName: "Uddin",
    employeeCode: "EMP001",
    joiningDate: new Date(2025, 0, 1),
    confirmationDate: new Date(2025, 5, 1),
    employmentType: "permanent",
    pfEnabled: true,
    salaryAssignments: [{
        isActive: true,
        grossSalary: 50_000,
        salaryStructure: {
            basicPercentage: 50,
        },
    }],
};

// ═══════════════════════════════════════════════════════════════════
// 1. GENERATION PIPELINE
// ═══════════════════════════════════════════════════════════════════

describe("Festival Bonus — Generation", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("throws when config not found", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(null);
        await expect(generateFestivalBonus({ bonusConfigId: "ghost" }))
            .rejects.toThrow("not found");
    });

    it("throws when config is not in draft status", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue({
            ...MOCK_CONFIG, status: "generated",
        } as never);
        await expect(generateFestivalBonus({ bonusConfigId: "config-001" }))
            .rejects.toThrow("already in");
    });

    it("generates bonus for eligible employees", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(MOCK_CONFIG as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([MOCK_EMPLOYEE] as never);
        vi.mocked(prisma.festivalBonusPayment.createMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);
        vi.mocked(differenceInCalendarDays).mockReturnValue(400); // > 365, no pro-rata

        const result = await generateFestivalBonus({ bonusConfigId: "config-001" });

        expect(result.totalEligible).toBe(1);
        expect(result.totalIneligible).toBe(0);
        expect(result.payments).toHaveLength(1);
        // Basic = 50,000 × 50% = 25,000. Bonus at 100% = 25,000
        expect(result.payments[0].amount).toBe(25_000);
        expect(result.totalAmount).toBe(25_000);
    });

    it("excludes employees with insufficient service days", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(MOCK_CONFIG as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([MOCK_EMPLOYEE] as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);
        vi.mocked(differenceInCalendarDays).mockReturnValue(30); // < 90 minimum

        const result = await generateFestivalBonus({ bonusConfigId: "config-001" });

        expect(result.totalEligible).toBe(0);
        expect(result.totalIneligible).toBe(1);
        expect(result.ineligibleReasons[0].reason).toContain("Insufficient service");
    });

    it("excludes probation employees when policy says so", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(MOCK_CONFIG as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([{
            ...MOCK_EMPLOYEE, employmentType: "probation",
        }] as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);
        vi.mocked(differenceInCalendarDays).mockReturnValue(200);

        const result = await generateFestivalBonus({ bonusConfigId: "config-001" });

        expect(result.totalIneligible).toBe(1);
        expect(result.ineligibleReasons[0].reason).toContain("Probation");
    });

    it("excludes contractual employees when policy says so", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(MOCK_CONFIG as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([{
            ...MOCK_EMPLOYEE, employmentType: "contractual",
        }] as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);
        vi.mocked(differenceInCalendarDays).mockReturnValue(200);

        const result = await generateFestivalBonus({ bonusConfigId: "config-001" });

        expect(result.totalIneligible).toBe(1);
        expect(result.ineligibleReasons[0].reason).toContain("Contractual");
    });

    it("excludes employees without salary structure", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(MOCK_CONFIG as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([{
            ...MOCK_EMPLOYEE, salaryAssignments: [],
        }] as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);
        vi.mocked(differenceInCalendarDays).mockReturnValue(200);

        const result = await generateFestivalBonus({ bonusConfigId: "config-001" });

        expect(result.totalIneligible).toBe(1);
        expect(result.ineligibleReasons[0].reason).toContain("No active salary");
    });

    it("applies pro-rata for new joiners (< 365 days)", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(MOCK_CONFIG as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([MOCK_EMPLOYEE] as never);
        vi.mocked(prisma.festivalBonusPayment.createMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);
        vi.mocked(differenceInCalendarDays).mockReturnValue(182); // ~6 months

        const result = await generateFestivalBonus({ bonusConfigId: "config-001" });

        expect(result.payments[0].isProRated).toBe(true);
        expect(result.payments[0].proRataFactor).toBeLessThan(1);
        expect(result.payments[0].proRataFactor).toBeCloseTo(0.50, 1);
        // Pro-rata: 182/365 ≈ 0.50, amount ≈ 25,000 × 0.50 = 12,500
        expect(result.payments[0].amount).toBeLessThan(25_000);
    });

    it("does NOT pro-rate employees with 365+ days service", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(MOCK_CONFIG as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([MOCK_EMPLOYEE] as never);
        vi.mocked(prisma.festivalBonusPayment.createMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);
        vi.mocked(differenceInCalendarDays).mockReturnValue(400);

        const result = await generateFestivalBonus({ bonusConfigId: "config-001" });

        expect(result.payments[0].proRataFactor).toBe(1);
        expect(result.payments[0].isProRated).toBe(false);
    });

    it("uses gross salary when calculationBasis is 'gross'", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue({
            ...MOCK_CONFIG, calculationBasis: "gross",
        } as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([MOCK_EMPLOYEE] as never);
        vi.mocked(prisma.festivalBonusPayment.createMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);
        vi.mocked(differenceInCalendarDays).mockReturnValue(400);

        const result = await generateFestivalBonus({ bonusConfigId: "config-001" });

        // Gross = 50,000 at 100% = 50,000
        expect(result.payments[0].basisAmount).toBe(50_000);
        expect(result.payments[0].amount).toBe(50_000);
    });

    it("deletes existing payments on re-generation", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue({
            ...MOCK_CONFIG, payments: [{ employeeId: "emp-old" }],
        } as never);
        vi.mocked(prisma.festivalBonusPayment.deleteMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);

        await generateFestivalBonus({ bonusConfigId: "config-001" });

        expect(prisma.festivalBonusPayment.deleteMany).toHaveBeenCalledWith({
            where: { bonusConfigId: "config-001" },
        });
    });

    it("updates config status to 'generated'", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(MOCK_CONFIG as never);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.festivalBonusConfig.update).mockResolvedValue({} as never);

        await generateFestivalBonus({ bonusConfigId: "config-001" });

        expect(prisma.festivalBonusConfig.update).toHaveBeenCalledWith({
            where: { id: "config-001" },
            data: { status: "generated" },
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// 2. PAYROLL INTEGRATION
// ═══════════════════════════════════════════════════════════════════

describe("Festival Bonus — Payroll Integration", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns 0 when no pending bonuses", async () => {
        vi.mocked(prisma.festivalBonusPayment.findMany).mockResolvedValue([]);
        const result = await getFestivalBonusForPayroll("emp-001", 4, 2026);
        expect(result).toBe(0);
    });

    it("sums multiple pending bonuses", async () => {
        vi.mocked(prisma.festivalBonusPayment.findMany).mockResolvedValue([
            { id: "bp-1", amount: 25_000, employeeId: "emp-001", status: "pending" },
            { id: "bp-2", amount: 10_000, employeeId: "emp-001", status: "pending" },
        ] as never);
        vi.mocked(prisma.festivalBonusPayment.update).mockResolvedValue({} as never);

        const result = await getFestivalBonusForPayroll("emp-001", 4, 2026);

        expect(result).toBe(35_000);
    });

    it("marks bonuses as included_in_payroll", async () => {
        vi.mocked(prisma.festivalBonusPayment.findMany).mockResolvedValue([
            { id: "bp-1", amount: 25_000, employeeId: "emp-001", status: "pending" },
        ] as never);
        vi.mocked(prisma.festivalBonusPayment.update).mockResolvedValue({} as never);

        await getFestivalBonusForPayroll("emp-001", 6, 2026);

        expect(prisma.festivalBonusPayment.update).toHaveBeenCalledWith({
            where: { id: "bp-1" },
            data: {
                status: "included_in_payroll",
                payrollMonth: 6,
                payrollYear: 2026,
            },
        });
    });

    it("returns rounded integer", async () => {
        vi.mocked(prisma.festivalBonusPayment.findMany).mockResolvedValue([
            { id: "bp-1", amount: 12_345.67, employeeId: "emp-001", status: "pending" },
        ] as never);
        vi.mocked(prisma.festivalBonusPayment.update).mockResolvedValue({} as never);

        const result = await getFestivalBonusForPayroll("emp-001", 4, 2026);
        expect(Number.isInteger(result)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 3. SUMMARY & REPORTING
// ═══════════════════════════════════════════════════════════════════

describe("Festival Bonus — Summary & Reporting", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns null for non-existent config", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue(null);
        const result = await getFestivalBonusSummary("ghost");
        expect(result).toBeNull();
    });

    it("returns correct summary with payment stats", async () => {
        vi.mocked(prisma.festivalBonusConfig.findUnique).mockResolvedValue({
            id: "config-001",
            name: "Eid Bonus",
            festivalType: "eid_ul_fitr",
            year: 2026,
            status: "generated",
            _count: { payments: 3 },
            payments: [
                { amount: 25_000, status: "pending" },
                { amount: 30_000, status: "included_in_payroll" },
                { amount: 20_000, status: "paid" },
            ],
        } as never);

        const result = await getFestivalBonusSummary("config-001");

        expect(result).not.toBeNull();
        expect(result!.totalPayments).toBe(3);
        expect(result!.totalAmount).toBe(75_000);
        expect(result!.pendingCount).toBe(1);
        expect(result!.paidCount).toBe(2); // included_in_payroll + paid
    });

    it("lists configs for organization", async () => {
        vi.mocked(prisma.festivalBonusConfig.findMany).mockResolvedValue([
            {
                id: "c1", name: "Eid 1", festivalType: "eid_ul_fitr", year: 2026,
                status: "generated", _count: { payments: 10 },
                payments: [{ amount: 10_000, status: "pending" }],
            },
        ] as never);

        const results = await listFestivalBonusConfigs("org-001", 2026);
        expect(results).toHaveLength(1);
        expect(results[0].totalAmount).toBe(10_000);
    });
});
