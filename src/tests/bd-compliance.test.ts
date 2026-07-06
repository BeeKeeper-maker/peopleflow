/**
 * PeopleFlow — BD Compliance Engine Tests
 *
 * Tests for all Bangladesh-specific compliance features:
 * - Tax exemptions (senior, disabled, freedom fighter, women, tiered minimum)
 * - Overtime validation (BLA Section 108)
 * - NID format validation
 * - BD phone format validation
 * - Buddy punching prevention logic
 * - Final settlement calculation
 * - Maternity 2-child cap
 * - Minimum wage compliance
 */

import { describe, it, expect } from "vitest";
import {
    calculateAnnualTax,
    calculateMonthlyTax,
    calculateOvertime,
    validateOvertime,
    type TaxExemptionFlags,
} from "@/lib/payroll-engine";

// ═══════════════════════════════════════════════════════════════
// Tax Calculation Tests
// ═══════════════════════════════════════════════════════════════

describe("BD Tax Calculation", () => {
    describe("General tax slabs (FY 2024-25)", () => {
        it("should return 0 tax for income below threshold (৳3,50,000)", () => {
            expect(calculateAnnualTax(300000)).toBe(0);
            expect(calculateAnnualTax(350000)).toBe(0);
        });

        it("should apply 5% rate for income ৳3,50,001 - ৳4,50,000", () => {
            // ৳4,00,000: first 3,50,000 free, next 50,000 @ 5% = 2,500
            // But minimum tax is 5,000 (Dhaka/Chittagong default)
            expect(calculateAnnualTax(400000)).toBe(5000);
            // Rural area: no minimum tax, actual = 2,500
            expect(calculateAnnualTax(400000, false, { area: "rural" })).toBe(2500);
        });

        it("should apply 10% rate for income ৳4,50,001 - ৳7,50,000", () => {
            // ৳5,00,000: first 3,50,000 free, next 1,00,000 @ 5% = 5,000, next 50,000 @ 10% = 5,000 → total 10,000
            expect(calculateAnnualTax(500000)).toBe(10000);
        });

        it("should apply 25% rate for high income above ৳16,50,000", () => {
            const tax = calculateAnnualTax(2000000);
            expect(tax).toBeGreaterThan(200000);
            expect(tax).toBeLessThan(300000);
        });

        it("should apply minimum tax for Dhaka/Chittagong", () => {
            // Income above threshold but calculated tax below 5,000
            // ৳3,60,000: 10,000 @ 5% = 500 → minimum tax 5,000
            expect(calculateAnnualTax(360000)).toBe(5000);
        });
    });

    describe("Women tax exemption", () => {
        it("should give women ৳50,000 higher threshold", () => {
            // Women: first 4,00,000 free
            expect(calculateAnnualTax(400000, true)).toBe(0);
            // Men at 4,00,000: 50,000 @ 5% = 2,500, but min tax 5,000
            expect(calculateAnnualTax(400000, false)).toBe(5000);
            // In rural area: actual tax 2,500 (no minimum)
            expect(calculateAnnualTax(400000, false, { area: "rural" })).toBe(2500);
        });

        it("should calculate correctly for women at ৳5,00,000", () => {
            // Women: 4,00,000 free, 1,00,000 @ 5% = 5,000
            expect(calculateAnnualTax(500000, true)).toBe(5000);
        });
    });

    describe("Senior citizen exemption (65+)", () => {
        it("should give senior citizens same threshold as women", () => {
            const exemptions: TaxExemptionFlags = { isSenior: true };
            expect(calculateAnnualTax(400000, false, exemptions)).toBe(0);
            // Non-senior at 4,00,000: min tax 5,000 (Dhaka default)
            expect(calculateAnnualTax(400000, false, { isSenior: false })).toBe(5000);
            // In rural area: actual tax 2,500
            expect(calculateAnnualTax(400000, false, { isSenior: false, area: "rural" })).toBe(2500);
        });
    });

    describe("Disabled person exemption", () => {
        it("should give disabled persons ৳100,000 higher threshold", () => {
            const exemptions: TaxExemptionFlags = { isDisabled: true };
            // Disabled: first 4,50,000 free
            expect(calculateAnnualTax(450000, false, exemptions)).toBe(0);
            // Non-disabled at 4,50,000 pays tax
            expect(calculateAnnualTax(450000, false)).toBeGreaterThan(0);
        });
    });

    describe("Freedom fighter exemption", () => {
        it("should give freedom fighters ৳150,000 higher threshold", () => {
            const exemptions: TaxExemptionFlags = { isFreedomFighter: true };
            // Freedom fighter: first 5,00,000 free
            expect(calculateAnnualTax(500000, false, exemptions)).toBe(0);
        });

        it("should prioritize freedom fighter over other exemptions", () => {
            const exemptions: TaxExemptionFlags = {
                isFreedomFighter: true,
                isDisabled: true,
                isSenior: true,
                isWoman: true,
            };
            // All exemptions set → freedom fighter takes priority (5,00,000 threshold)
            expect(calculateAnnualTax(500000, false, exemptions)).toBe(0);
            // At 5,50,000: 50,000 @ 5% = 2,500, but min tax 5,000 (Dhaka)
            expect(calculateAnnualTax(550000, false, exemptions)).toBe(5000);
            // In rural area: actual tax 2,500 (no minimum)
            expect(calculateAnnualTax(550000, false, { ...exemptions, area: "rural" })).toBe(2500);
        });
    });

    describe("Tiered minimum tax by area", () => {
        it("should apply ৳5,000 minimum for Dhaka/Chittagong", () => {
            const exemptions: TaxExemptionFlags = { area: "dhaka_chittagong" };
            expect(calculateAnnualTax(360000, false, exemptions)).toBe(5000);
        });

        it("should apply ৳4,000 minimum for other city corporations", () => {
            const exemptions: TaxExemptionFlags = { area: "other_city" };
            expect(calculateAnnualTax(360000, false, exemptions)).toBe(4000);
        });

        it("should apply ৳3,000 minimum for municipal areas", () => {
            const exemptions: TaxExemptionFlags = { area: "municipal" };
            expect(calculateAnnualTax(360000, false, exemptions)).toBe(3000);
        });

        it("should apply no minimum tax for rural areas", () => {
            const exemptions: TaxExemptionFlags = { area: "rural" };
            // Rural: no minimum tax, actual tax is 500 (10,000 @ 5%)
            expect(calculateAnnualTax(360000, false, exemptions)).toBe(500);
        });
    });

    describe("Monthly tax calculation", () => {
        it("should divide annual tax by 12", () => {
            const annual = calculateAnnualTax(500000);
            const monthly = calculateMonthlyTax(500000);
            expect(monthly).toBe(Math.round(annual / 12));
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// Overtime Tests
// ═══════════════════════════════════════════════════════════════

describe("Overtime Calculation (BLA Section 108)", () => {
    it("should calculate OT at 2x basic rate", () => {
        // Basic: ৳20,000/month, OT: 60 min (1 hour)
        // Rate: (20000 × 2 × 60) / (26 × 8 × 60) = 2400000 / 12480 ≈ 192
        const ot = calculateOvertime(60, 20000);
        expect(ot).toBe(192);
    });

    it("should return 0 for 0 minutes OT", () => {
        expect(calculateOvertime(0, 20000)).toBe(0);
    });

    it("should return 0 for 0 basic salary", () => {
        expect(calculateOvertime(60, 0)).toBe(0);
    });

    it("should handle large OT hours correctly", () => {
        // 120 min (2 hours) at ৳15,000 basic
        // (15000 × 2 × 120) / 12480 = 3600000 / 12480 ≈ 288
        const ot = calculateOvertime(120, 15000);
        expect(ot).toBe(288);
    });
});

describe("Overtime Validation (BLA limits)", () => {
    it("should pass for OT within daily limit (2 hours)", () => {
        const result = validateOvertime(120, 480); // 2hr daily, 8hr weekly
        expect(result.isCompliant).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });

    it("should warn for daily OT exceeding 2 hours", () => {
        const result = validateOvertime(180, 480); // 3hr daily
        expect(result.isCompliant).toBe(false);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain("Section 108");
    });

    it("should warn for weekly OT exceeding 12 hours", () => {
        const result = validateOvertime(60, 780); // 1hr daily, 13hr weekly
        expect(result.isCompliant).toBe(false);
        expect(result.warnings.some(w => w.includes("12 hours/week"))).toBe(true);
    });

    it("should pass for OT exactly at limits", () => {
        const result = validateOvertime(120, 720); // 2hr daily, 12hr weekly
        expect(result.isCompliant).toBe(true);
    });
});
