/**
 * ═══════════════════════════════════════════════════════════════════
 * LATE DEDUCTION ENGINE — TIERED SEVERITY TEST SUITE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests the full tiered late deduction system:
 *   - Policy loading & legacy fallback
 *   - Tier-based deduction calculation (grace → half-day → full-day)
 *   - Warning generation at each tier
 *   - Edge cases (zero lates, all in grace, overflow to final tier)
 *   - Employee late statistics dashboard query
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import {
    calculateLateDeduction,
    getEmployeeLateStats,
} from "@/lib/late-deduction-engine";

// ── Test Fixtures ───────────────────────────────────────────────────

const DAILY_SALARY = 2_000; // BDT 2,000/day for easy math

const MOCK_POLICY = {
    id: "policy-001",
    organizationId: "org-001",
    isActive: true,
    lateThresholdMinutes: 10, // >10 min late counts
    tiers: [
        {
            id: "t1", name: "Grace Period", tierOrder: 1,
            fromCount: 1, toCount: 3, deductionType: "none", deductionValue: 0,
            issueWarning: false, warningLevel: "none",
        },
        {
            id: "t2", name: "Warning Tier", tierOrder: 2,
            fromCount: 4, toCount: 6, deductionType: "half_day", deductionValue: 0,
            issueWarning: true, warningLevel: "verbal",
        },
        {
            id: "t3", name: "Penalty Tier", tierOrder: 3,
            fromCount: 7, toCount: 9, deductionType: "full_day", deductionValue: 0,
            issueWarning: true, warningLevel: "written",
        },
        {
            id: "t4", name: "Final Warning", tierOrder: 4,
            fromCount: 10, toCount: 999, deductionType: "full_day", deductionValue: 0,
            issueWarning: true, warningLevel: "final",
        },
    ],
};

function buildLateRecords(count: number, lateMinutes = 15) {
    return Array.from({ length: count }, (_, i) => ({
        id: `late-${i}`,
        date: new Date(2026, 3, i + 1),
        lateMinutes,
    }));
}

// ═══════════════════════════════════════════════════════════════════
// 1. TIERED DEDUCTION CALCULATION
// ═══════════════════════════════════════════════════════════════════

describe("Late Deduction — Tiered System", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns zero deduction when no lates recorded", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(MOCK_POLICY as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        expect(result.totalLateCount).toBe(0);
        expect(result.deductionAmount).toBe(0);
        expect(result.warnings).toHaveLength(0);
        expect(result.tierBreakdown).toHaveLength(0);
    });

    it("applies grace period (no deduction) for 1-3 lates", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(MOCK_POLICY as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildLateRecords(3) as never);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        expect(result.totalLateCount).toBe(3);
        expect(result.deductionAmount).toBe(0); // All in grace
        expect(result.warnings).toHaveLength(0);
    });

    it("applies half-day deduction for lates 4-6", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(MOCK_POLICY as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildLateRecords(6) as never);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        expect(result.totalLateCount).toBe(6);
        // Lates 1-3: grace (0), Lates 4-6: half-day × 3 = 3 × 1,000 = 3,000
        expect(result.deductionAmount).toBe(3_000);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].warningLevel).toBe("verbal");
    });

    it("applies full-day deduction for lates 7-9", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(MOCK_POLICY as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildLateRecords(9) as never);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        expect(result.totalLateCount).toBe(9);
        // Grace: 0, Half-day: 3 × 1,000 = 3,000, Full-day: 3 × 2,000 = 6,000
        expect(result.deductionAmount).toBe(9_000);
        expect(result.warnings).toHaveLength(2); // verbal + written
    });

    it("applies final warning tier for 10+ lates", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(MOCK_POLICY as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildLateRecords(12) as never);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        expect(result.totalLateCount).toBe(12);
        // Grace: 0, Half: 3×1000=3000, Full T3: 3×2000=6000, Full T4: 3×2000=6000
        expect(result.deductionAmount).toBe(15_000);
        expect(result.warnings).toHaveLength(3); // verbal + written + final
        expect(result.warnings[2].warningLevel).toBe("final");
    });

    it("deduction is always a rounded integer", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(MOCK_POLICY as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildLateRecords(5) as never);

        // Odd daily salary to test rounding
        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, 3_333);

        expect(Number.isInteger(result.deductionAmount)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 2. LEGACY FALLBACK (3 lates = 1 day)
// ═══════════════════════════════════════════════════════════════════

describe("Late Deduction — Legacy Fallback", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("falls back to legacy when no policy is configured", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.attendance.count).mockResolvedValue(6);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        // 6 lates / 3 = 2 days × 2,000 = 4,000
        expect(result.totalLateCount).toBe(6);
        expect(result.deductionAmount).toBe(4_000);
    });

    it("falls back when policy has empty tiers", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue({
            ...MOCK_POLICY, tiers: [],
        } as never);
        vi.mocked(prisma.attendance.count).mockResolvedValue(3);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        // 3 lates / 3 = 1 day × 2,000 = 2,000
        expect(result.deductionAmount).toBe(2_000);
    });

    it("legacy: 2 lates = no deduction (floor(2/3) = 0)", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.attendance.count).mockResolvedValue(2);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        expect(result.deductionAmount).toBe(0);
        expect(result.tierBreakdown).toHaveLength(0);
    });

    it("legacy: zero lates = zero deduction", async () => {
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.attendance.count).mockResolvedValue(0);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        expect(result.totalLateCount).toBe(0);
        expect(result.deductionAmount).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 3. FIXED AMOUNT & PERCENTAGE DEDUCTION TYPES
// ═══════════════════════════════════════════════════════════════════

describe("Late Deduction — Custom Deduction Types", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("applies fixed_amount deduction per late", async () => {
        const fixedPolicy = {
            ...MOCK_POLICY,
            tiers: [{
                id: "t1", name: "Fixed Fine", tierOrder: 1,
                fromCount: 1, toCount: 999, deductionType: "fixed_amount",
                deductionValue: 500, issueWarning: false, warningLevel: "none",
            }],
        };
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(fixedPolicy as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildLateRecords(4) as never);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        // 4 lates × 500 BDT = 2,000
        expect(result.deductionAmount).toBe(2_000);
    });

    it("applies percentage_of_daily deduction", async () => {
        const pctPolicy = {
            ...MOCK_POLICY,
            tiers: [{
                id: "t1", name: "25% Daily", tierOrder: 1,
                fromCount: 1, toCount: 999, deductionType: "percentage_of_daily",
                deductionValue: 25, issueWarning: false, warningLevel: "none",
            }],
        };
        vi.mocked(prisma.lateDeductionPolicy.findFirst).mockResolvedValue(pctPolicy as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildLateRecords(4) as never);

        const result = await calculateLateDeduction("org-001", "emp-001", 4, 2026, DAILY_SALARY);

        // 4 lates × (2,000 × 25%) = 4 × 500 = 2,000
        expect(result.deductionAmount).toBe(2_000);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 4. EMPLOYEE LATE STATS (Dashboard)
// ═══════════════════════════════════════════════════════════════════

describe("Employee Late Stats", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns zero stats when no lates", async () => {
        vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);

        const stats = await getEmployeeLateStats("emp-001", 4, 2026);

        expect(stats.totalLates).toBe(0);
        expect(stats.totalLateMinutes).toBe(0);
        expect(stats.averageLateMinutes).toBe(0);
        expect(stats.worstLateMinutes).toBe(0);
    });

    it("calculates correct stats for multiple lates", async () => {
        vi.mocked(prisma.attendance.findMany).mockResolvedValue([
            { lateMinutes: 10 },
            { lateMinutes: 30 },
            { lateMinutes: 20 },
        ] as never);

        const stats = await getEmployeeLateStats("emp-001", 4, 2026);

        expect(stats.totalLates).toBe(3);
        expect(stats.totalLateMinutes).toBe(60);
        expect(stats.averageLateMinutes).toBe(20);
        expect(stats.worstLateMinutes).toBe(30);
    });
});
