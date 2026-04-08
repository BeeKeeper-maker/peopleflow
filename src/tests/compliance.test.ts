/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPLIANCE ENGINE — EXHAUSTIVE TEST SUITE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests all Bangladesh Labor Act 2006 compliance validators.
 *
 * Test Categories:
 *   1. Minimum Wage — Sector-specific validation
 *   2. Overtime — Daily/weekly hour limits, 2x rate enforcement  
 *   3. Gratuity — 5-year cliff, daily wage formula
 *   4. Leave Entitlements — Annual/casual/sick/maternity bounds
 *   5. Weekly Holiday — Section 103
 *   6. Notice Period — Section 26
 *   7. PF Contribution — Employer ≥ employee rule
 *   8. Full Compliance Audit — Combined validation
 */

import { describe, it, expect } from "vitest";
import {
    validateMinimumWage,
    validateOvertime,
    calculateGratuity,
    calculateFestivalBonus,
    validatePFContribution,
    validateLeaveEntitlement,
    validateWeeklyHoliday,
    validateNoticePeriod,
    runFullComplianceAudit,
} from "@/lib/compliance";

// ═══════════════════════════════════════════════════════════════════
// 1. MINIMUM WAGE VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe("Minimum Wage Validation", () => {
    it("passes when salary meets general minimum", () => {
        const result = validateMinimumWage(10_000, "general");
        expect(result.isCompliant).toBe(true);
        expect(result.violations).toHaveLength(0);
    });

    it("fails when salary below general minimum", () => {
        const result = validateMinimumWage(9_999, "general");
        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].code).toBe("MW-001");
        expect(result.violations[0].severity).toBe("critical");
    });

    it.each([
        ["rmg", 12_500],
        ["tannery", 13_500],
        ["pharmaceuticals", 11_000],
        ["jute", 9_300],
        ["tea", 5_200],
        ["shrimp", 10_200],
        ["it_ites", 15_000],
        ["banking", 20_000],
        ["general", 10_000],
    ])("validates sector '%s' with minimum %i BDT", (sector, minWage) => {
        // Exactly at minimum — should pass
        expect(validateMinimumWage(minWage, sector).isCompliant).toBe(true);
        // 1 BDT below — should fail
        expect(validateMinimumWage(minWage - 1, sector).isCompliant).toBe(false);
    });

    it("falls back to general minimum for unknown sector", () => {
        const result = validateMinimumWage(9_999, "space_industry");
        expect(result.isCompliant).toBe(false); // 9,999 < 10,000 general
    });

    it("passes with exact boundary value", () => {
        expect(validateMinimumWage(12_500, "rmg").isCompliant).toBe(true);
    });

    it("references Section 149 in violation", () => {
        const result = validateMinimumWage(1, "general");
        expect(result.violations[0].reference).toContain("Section 149");
    });

    it("handles zero salary", () => {
        const result = validateMinimumWage(0, "general");
        expect(result.isCompliant).toBe(false);
    });

    it("handles negative salary", () => {
        const result = validateMinimumWage(-5000, "general");
        expect(result.isCompliant).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 2. OVERTIME COMPLIANCE
// ═══════════════════════════════════════════════════════════════════

describe("Overtime Compliance (BLA 2006 §100-108)", () => {
    it("passes for normal working hours (8h/day, 48h/week)", () => {
        const result = validateOvertime(8, 48, 200, 100);
        expect(result.isCompliant).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
    });

    it("warns for overtime within legal limits (9h/day)", () => {
        const result = validateOvertime(9, 54, 200, 100);
        expect(result.isCompliant).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].code).toBe("OT-W001");
    });

    it("fails when daily hours exceed 10", () => {
        const result = validateOvertime(11, 55, 200, 100);
        expect(result.isCompliant).toBe(false);
        expect(result.violations.some(v => v.code === "OT-001")).toBe(true);
    });

    it("fails when weekly hours exceed 60", () => {
        const result = validateOvertime(10, 61, 200, 100);
        expect(result.isCompliant).toBe(false);
        expect(result.violations.some(v => v.code === "OT-002")).toBe(true);
    });

    it("fails when OT rate is below 2x basic hourly", () => {
        // Basic hourly = 100, minimum OT = 200
        const result = validateOvertime(9, 54, 199, 100);
        expect(result.isCompliant).toBe(false);
        expect(result.violations.some(v => v.code === "OT-003")).toBe(true);
    });

    it("passes when OT rate equals exactly 2x", () => {
        const result = validateOvertime(9, 54, 200, 100);
        expect(result.isCompliant).toBe(true);
    });

    it("passes when OT rate exceeds 2x", () => {
        const result = validateOvertime(9, 54, 300, 100);
        expect(result.isCompliant).toBe(true);
    });

    it("does not flag OT rate when zero (no overtime worked)", () => {
        const result = validateOvertime(8, 48, 0, 100);
        expect(result.isCompliant).toBe(true);
    });

    it("generates multiple violations for extreme case", () => {
        const result = validateOvertime(12, 72, 50, 100);
        expect(result.isCompliant).toBe(false);
        expect(result.violations.length).toBe(3); // daily + weekly + rate
    });

    it("boundary: exactly 10 daily hours (no violation)", () => {
        const result = validateOvertime(10, 50, 200, 100);
        expect(result.isCompliant).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0); // warning for OT
    });

    it("boundary: exactly 60 weekly hours (no violation)", () => {
        const result = validateOvertime(10, 60, 200, 100);
        expect(result.isCompliant).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 3. GRATUITY (Compliance Module Version)
// ═══════════════════════════════════════════════════════════════════

describe("Gratuity Compliance (BLA 2006 §27)", () => {
    it("not eligible before 5 years", () => {
        const result = calculateGratuity(50_000, 4);
        expect(result.eligible).toBe(false);
        expect(result.amount).toBe(0);
        expect(result.basis).toContain("Not eligible");
    });

    it("eligible at exactly 5 years", () => {
        const result = calculateGratuity(50_000, 5);
        expect(result.eligible).toBe(true);
        expect(result.amount).toBeGreaterThan(0);
        expect(result.basis).toContain("Section 27");
    });

    it("formula consistency: (basic/26) × 30 × years", () => {
        const basic = 40_000;
        const years = 10;
        const result = calculateGratuity(basic, years);
        const expected = Math.round((basic / 26) * 30 * years);
        expect(result.amount).toBe(expected);
    });

    it("zero basic salary yields zero gratuity", () => {
        const result = calculateGratuity(0, 10);
        expect(result.eligible).toBe(true);
        expect(result.amount).toBe(0);
    });

    it("cross-validates with payroll-engine gratuity", () => {
        // The compliance module's calculateGratuity should match
        // the payroll-engine's calculateGratuity for same inputs
        const basic = 60_000;
        const years = 8;
        const complianceResult = calculateGratuity(basic, years);
        // Inline the payroll engine formula
        const payrollExpected = Math.round((basic / 26) * 30 * years);
        expect(complianceResult.amount).toBe(payrollExpected);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 4. LEAVE ENTITLEMENT VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe("Leave Entitlement Validation (BLA 2006 §115-118)", () => {
    it("passes with compliant leave policy", () => {
        const result = validateLeaveEntitlement(14, 10, 14);
        expect(result.isCompliant).toBe(true);
        expect(result.violations).toHaveLength(0);
    });

    it("fails when annual leave < 14 days", () => {
        const result = validateLeaveEntitlement(13, 10, 14);
        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].code).toBe("LV-001");
    });

    it("fails when casual leave < 10 days", () => {
        const result = validateLeaveEntitlement(14, 9, 14);
        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].code).toBe("LV-002");
    });

    it("fails when sick leave < 14 days", () => {
        const result = validateLeaveEntitlement(14, 10, 13);
        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].code).toBe("LV-003");
    });

    it("fails when maternity leave < 112 days (16 weeks)", () => {
        const result = validateLeaveEntitlement(14, 10, 14, 111);
        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].code).toBe("LV-004");
        expect(result.violations[0].severity).toBe("critical");
    });

    it("passes with exact maternity minimum (112 days)", () => {
        const result = validateLeaveEntitlement(14, 10, 14, 112);
        expect(result.isCompliant).toBe(true);
    });

    it("ignores maternity when not provided (undefined)", () => {
        const result = validateLeaveEntitlement(14, 10, 14);
        expect(result.isCompliant).toBe(true);
        expect(result.violations.filter(v => v.code === "LV-004")).toHaveLength(0);
    });

    it("generates multiple violations for fully non-compliant policy", () => {
        const result = validateLeaveEntitlement(5, 3, 7, 60);
        expect(result.isCompliant).toBe(false);
        expect(result.violations.length).toBe(4); // all 4 types violated
    });

    it("exact boundaries pass", () => {
        expect(validateLeaveEntitlement(14, 10, 14, 112).isCompliant).toBe(true);
    });

    it("zero leaves fail all checks", () => {
        const result = validateLeaveEntitlement(0, 0, 0, 0);
        expect(result.isCompliant).toBe(false);
        expect(result.violations.length).toBe(4);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 5. WEEKLY HOLIDAY VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe("Weekly Holiday (BLA 2006 §103)", () => {
    it("passes for 5-day work week", () => {
        expect(validateWeeklyHoliday(5).isCompliant).toBe(true);
    });

    it("passes for 6-day work week", () => {
        expect(validateWeeklyHoliday(6).isCompliant).toBe(true);
    });

    it("fails for 7-day work week", () => {
        const result = validateWeeklyHoliday(7);
        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].code).toBe("WH-001");
    });

    it("passes for 0 days worked", () => {
        expect(validateWeeklyHoliday(0).isCompliant).toBe(true);
    });

    it("fails for extreme overwork (10 days in a week)", () => {
        const result = validateWeeklyHoliday(10);
        expect(result.isCompliant).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 6. NOTICE PERIOD VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe("Notice Period (BLA 2006 §26)", () => {
    it("permanent: passes with 120+ days", () => {
        expect(validateNoticePeriod(120, "permanent").isCompliant).toBe(true);
    });

    it("permanent: fails with 119 days", () => {
        const result = validateNoticePeriod(119, "permanent");
        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].code).toBe("NP-001");
    });

    it("temporary: passes with 60+ days", () => {
        expect(validateNoticePeriod(60, "temporary").isCompliant).toBe(true);
    });

    it("temporary: fails with 59 days", () => {
        expect(validateNoticePeriod(59, "temporary").isCompliant).toBe(false);
    });

    it("probation: passes with 0 days", () => {
        expect(validateNoticePeriod(0, "probation").isCompliant).toBe(true);
    });

    it("probation: always passes", () => {
        expect(validateNoticePeriod(0, "probation").isCompliant).toBe(true);
        expect(validateNoticePeriod(30, "probation").isCompliant).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 7. PF CONTRIBUTION VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe("PF Contribution Compliance", () => {
    it("passes when employer ≥ employee contribution", () => {
        const result = validatePFContribution(5000, 5000, 50_000);
        expect(result.isCompliant).toBe(true);
    });

    it("fails when employer < employee contribution", () => {
        const result = validatePFContribution(5000, 4999, 50_000);
        expect(result.isCompliant).toBe(false);
        expect(result.violations[0].code).toBe("PF-001");
    });

    it("warns when employee contribution < 10% of basic", () => {
        const result = validatePFContribution(4000, 4000, 50_000);
        // 10% of 50k = 5k, contribution is 4k → warning
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].code).toBe("PF-W001");
    });

    it("no warning when employee at exactly 10%", () => {
        const result = validatePFContribution(5000, 5000, 50_000);
        expect(result.warnings).toHaveLength(0);
    });

    it("handles zero contributions", () => {
        const result = validatePFContribution(0, 0, 50_000);
        // 0 < 5k → warning, but employer (0) = employee (0) → no PF-001 violation  
        expect(result.isCompliant).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 8. FESTIVAL BONUS (Legacy, deprecated)
// ═══════════════════════════════════════════════════════════════════

describe("Festival Bonus (Legacy)", () => {
    it("calculates 100% of basic for each Eid", () => {
        const result = calculateFestivalBonus(50_000);
        expect(result.amount).toBe(50_000); // Per bonus
        expect(result.total).toBe(100_000); // 2 Eids
    });

    it("calculates custom percentage", () => {
        const result = calculateFestivalBonus(50_000, 50);
        expect(result.amount).toBe(25_000);
        expect(result.total).toBe(50_000);
    });

    it("handles 0 basic salary", () => {
        const result = calculateFestivalBonus(0, 100);
        expect(result.amount).toBe(0);
        expect(result.total).toBe(0);
    });

    it("rounds to integer", () => {
        const result = calculateFestivalBonus(33_333, 100);
        expect(Number.isInteger(result.amount)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 9. FULL COMPLIANCE AUDIT
// ═══════════════════════════════════════════════════════════════════

describe("Full Compliance Audit", () => {
    it("fully compliant organization", () => {
        const result = runFullComplianceAudit({
            monthlyGross: 50_000,
            basicSalary: 25_000,
            pfEmployee: 2500,
            pfEmployer: 2500,
            annualLeave: 14,
            casualLeave: 10,
            sickLeave: 14,
            yearsOfService: 3,
        });
        expect(result.isCompliant).toBe(true);
        expect(result.violations).toHaveLength(0);
    });

    it("fully non-compliant organization", () => {
        const result = runFullComplianceAudit({
            monthlyGross: 5_000, // below minimum
            basicSalary: 3_000,
            pfEmployee: 500,
            pfEmployer: 200, // less than employee
            annualLeave: 5,
            casualLeave: 3,
            sickLeave: 5,
            maternityLeave: 30,
            yearsOfService: 1,
        });
        expect(result.isCompliant).toBe(false);
        expect(result.violations.length).toBeGreaterThanOrEqual(5);
    });

    it("adds gratuity warning for 5+ years service", () => {
        const result = runFullComplianceAudit({
            monthlyGross: 50_000,
            basicSalary: 25_000,
            pfEmployee: 2500,
            pfEmployer: 2500,
            annualLeave: 14,
            casualLeave: 10,
            sickLeave: 14,
            yearsOfService: 10,
        });
        expect(result.warnings.some(w => w.code === "GR-W001")).toBe(true);
    });

    it("no gratuity warning for < 5 years", () => {
        const result = runFullComplianceAudit({
            monthlyGross: 50_000,
            basicSalary: 25_000,
            pfEmployee: 2500,
            pfEmployer: 2500,
            annualLeave: 14,
            casualLeave: 10,
            sickLeave: 14,
            yearsOfService: 4,
        });
        expect(result.warnings.some(w => w.code === "GR-W001")).toBe(false);
    });
});
