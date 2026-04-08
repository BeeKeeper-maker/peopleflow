/**
 * ═══════════════════════════════════════════════════════════════════
 * LEAVE COMPLIANCE ENGINE — EXHAUSTIVE TEST SUITE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests BLA 2006 maternity leave validation (§46-47) and
 * earned leave pro-rata calculation (§117).
 *
 * Test Categories:
 *   1. Maternity Config Constants — Verify legal limits
 *   2. Earned Leave Pro-Rata — 1 day per 18 working days
 *   3. Earned Leave Edge Cases — Boundary, precision, leap year
 */

import { describe, it, expect } from "vitest";
import {
    MATERNITY_CONFIG,
    calculateEarnedLeave,
    EARNED_LEAVE_RATIO,
} from "@/lib/leave-compliance-engine";

// ═══════════════════════════════════════════════════════════════════
// 1. MATERNITY LEAVE CONFIG CONSTANTS
// ═══════════════════════════════════════════════════════════════════

describe("Maternity Leave Config (BLA 2006 §46-47)", () => {
    it("total maternity leave is exactly 16 weeks / 112 days", () => {
        expect(MATERNITY_CONFIG.TOTAL_WEEKS).toBe(16);
        expect(MATERNITY_CONFIG.TOTAL_DAYS).toBe(112);
    });

    it("pre-delivery is exactly 8 weeks / 56 days", () => {
        expect(MATERNITY_CONFIG.PRE_DELIVERY_WEEKS).toBe(8);
        expect(MATERNITY_CONFIG.PRE_DELIVERY_DAYS).toBe(56);
    });

    it("post-delivery is exactly 8 weeks / 56 days", () => {
        expect(MATERNITY_CONFIG.POST_DELIVERY_WEEKS).toBe(8);
        expect(MATERNITY_CONFIG.POST_DELIVERY_DAYS).toBe(56);
    });

    it("pre + post equals total", () => {
        expect(MATERNITY_CONFIG.PRE_DELIVERY_DAYS + MATERNITY_CONFIG.POST_DELIVERY_DAYS)
            .toBe(MATERNITY_CONFIG.TOTAL_DAYS);
    });

    it("minimum service is 180 days (6 months)", () => {
        expect(MATERNITY_CONFIG.MIN_SERVICE_DAYS).toBe(180);
    });

    it("max children coverage is 2", () => {
        expect(MATERNITY_CONFIG.MAX_CHILDREN).toBe(2);
    });

    it("config values are all defined and non-zero", () => {
        // `as const` is TypeScript compile-time enforcement only
        // Runtime validation: ensure all keys exist and are positive integers
        expect(MATERNITY_CONFIG.TOTAL_WEEKS).toBeGreaterThan(0);
        expect(MATERNITY_CONFIG.TOTAL_DAYS).toBeGreaterThan(0);
        expect(MATERNITY_CONFIG.PRE_DELIVERY_WEEKS).toBeGreaterThan(0);
        expect(MATERNITY_CONFIG.POST_DELIVERY_WEEKS).toBeGreaterThan(0);
        expect(MATERNITY_CONFIG.MIN_SERVICE_DAYS).toBeGreaterThan(0);
        expect(MATERNITY_CONFIG.MAX_CHILDREN).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 2. EARNED LEAVE PRO-RATA (BLA 2006 §117)
// ═══════════════════════════════════════════════════════════════════

describe("Earned Leave Calculation (BLA 2006 §117)", () => {
    it("ratio constant is 18 (1 day per 18 working days)", () => {
        expect(EARNED_LEAVE_RATIO).toBe(18);
    });

    it("full year (312 working days) yields ~17 days", () => {
        // 312 / 18 = 17.33 → floor to 0.5 → 17.0
        const result = calculateEarnedLeave(312);
        expect(result).toBe(17);
    });

    it("half year (156 working days) yields ~8.5 days", () => {
        // 156 / 18 = 8.67 → floor to 0.5 → 8.5
        const result = calculateEarnedLeave(156);
        expect(result).toBe(8.5);
    });

    it("zero working days yields 0 leave", () => {
        expect(calculateEarnedLeave(0)).toBe(0);
    });

    it("18 working days yields exactly 1 day", () => {
        expect(calculateEarnedLeave(18)).toBe(1);
    });

    it("36 working days yields exactly 2 days", () => {
        expect(calculateEarnedLeave(36)).toBe(2);
    });

    it("17 working days yields 0.5 days (below 1, but above 0.5 threshold)", () => {
        // 17 / 18 = 0.944 → floor(0.944 * 2) / 2 = floor(1.889) / 2 = 1/2 = 0.5
        expect(calculateEarnedLeave(17)).toBe(0.5);
    });

    it("9 working days yields 0.5 days", () => {
        // 9 / 18 = 0.5 → floor(0.5 * 2) / 2 = floor(1) / 2 = 0.5
        expect(calculateEarnedLeave(9)).toBe(0.5);
    });

    it("8 working days yields 0 days", () => {
        // 8 / 18 = 0.444 → floor(0.444 * 2) / 2 = floor(0.889) / 2 = 0/2 = 0
        expect(calculateEarnedLeave(8)).toBe(0);
    });

    it("result is always a multiple of 0.5", () => {
        for (let days = 0; days <= 365; days++) {
            const result = calculateEarnedLeave(days);
            expect(result % 0.5).toBe(0);
        }
    });

    it("result never exceeds (workingDays / 18)", () => {
        for (let days = 0; days <= 365; days++) {
            const result = calculateEarnedLeave(days);
            expect(result).toBeLessThanOrEqual(days / EARNED_LEAVE_RATIO);
        }
    });

    it("result is always non-negative", () => {
        expect(calculateEarnedLeave(0)).toBeGreaterThanOrEqual(0);
        expect(calculateEarnedLeave(1)).toBeGreaterThanOrEqual(0);
    });

    it("monotonically increases with working days", () => {
        let prev = 0;
        for (let days = 0; days <= 400; days++) {
            const current = calculateEarnedLeave(days);
            expect(current).toBeGreaterThanOrEqual(prev);
            prev = current;
        }
    });
});

// ═══════════════════════════════════════════════════════════════════
// 3. EARNED LEAVE — PARAMETERIZED EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe("Earned Leave — Parameterized Tests", () => {
    const testCases: [number, number][] = [
        [0, 0],
        [1, 0],
        [8, 0],
        [9, 0.5],
        [17, 0.5],
        [18, 1.0],
        [19, 1.0],
        [26, 1.0],
        [27, 1.5],
        [35, 1.5],
        [36, 2.0],
        [100, 5.5],
        [180, 10.0],
        [252, 14.0],  // ~minimum statutory annual leave
        [312, 17.0],  // Standard full year
        [365, 20.0],  // Calendar max (impossible — includes weekends)
    ];

    it.each(testCases)(
        "%i working days → %f earned leave days",
        (workingDays, expectedLeave) => {
            expect(calculateEarnedLeave(workingDays)).toBe(expectedLeave);
        }
    );
});

// ═══════════════════════════════════════════════════════════════════
// 4. FLOATING-POINT PRECISION GUARD
// ═══════════════════════════════════════════════════════════════════

describe("Earned Leave — Floating-Point Safety", () => {
    it("handles non-integer input (half-days from attendance)", () => {
        // If attendance engine reports 156.5 working days (with half-days)
        const result = calculateEarnedLeave(156.5);
        // 156.5 / 18 = 8.694 → floor(8.694 * 2) / 2 = floor(17.389) / 2 = 8.5
        expect(result).toBe(8.5);
    });

    it("avoids classic 0.1 + 0.2 IEEE 754 trap", () => {
        // Working days that could trigger floating point weirdness
        const result = calculateEarnedLeave(27);
        // 27 / 18 = 1.5 → floor(1.5 * 2) / 2 = floor(3) / 2 = 1.5
        expect(result).toBe(1.5);
        expect(result).toStrictEqual(1.5);
    });

    it("handles very large working day counts", () => {
        // Emergency: someone inputs 10,000 days
        const result = calculateEarnedLeave(10_000);
        expect(result).toBe(Math.floor((10_000 / 18) * 2) / 2);
        expect(Number.isFinite(result)).toBe(true);
    });
});
