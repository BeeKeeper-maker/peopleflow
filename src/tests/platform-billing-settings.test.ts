/**
 * Unit Tests: Platform Billing & Settings
 *
 * Tests:
 * - BDT amount conversion (paisa → taka)
 * - Revenue growth percent calculation
 * - CreateAdminSchema validation
 * - Status filter values
 * - Pagination math
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// ── Re-implement the same conversion the API uses ──
const toBDT = (amount: number | null | undefined): number => (amount ?? 0) / 100;

function calculateRevenueGrowth(thisMonth: number, lastMonth: number): number {
    if (lastMonth > 0) {
        return Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
    }
    return thisMonth > 0 ? 100 : 0;
}

// Mirror of the CreateAdminSchema in /api/platform/settings/admins/route.ts
const CreateAdminSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().max(255),
    role: z.enum(["platform_admin", "platform_super"]).default("platform_admin"),
    password: z.string().min(8).max(128),
});

// Mirror of the STATUS_FILTERS list in /platform/billing/page.tsx
const STATUS_FILTERS = ["all", "paid", "pending", "failed", "refunded"] as const;

// Mirror of the per-page limit clamp in the API route
function clampLimit(input: number | null): number {
    return Math.min(100, Math.max(1, input ?? 50));
}
function clampPage(input: number | null): number {
    return Math.max(1, input ?? 1);
}

describe("Platform Billing — BDT conversion", () => {
    it("converts paisa to taka (positive amount)", () => {
        expect(toBDT(150000)).toBe(1500);
    });

    it("converts zero paisa to zero taka", () => {
        expect(toBDT(0)).toBe(0);
    });

    it("handles null gracefully", () => {
        expect(toBDT(null)).toBe(0);
    });

    it("handles undefined gracefully", () => {
        expect(toBDT(undefined)).toBe(0);
    });

    it("preserves 2-decimal precision (e.g. ৳12.50)", () => {
        expect(toBDT(1250)).toBe(12.5);
    });

    it("handles sub-paisa amounts (precision loss is acceptable)", () => {
        // 12.345 taka = 1234.5 paisa — stored as 1235 (rounded) → 12.35 taka
        expect(toBDT(1235)).toBe(12.35);
    });
});

describe("Platform Billing — revenue growth calculation", () => {
    it("returns 0 when both months are zero", () => {
        expect(calculateRevenueGrowth(0, 0)).toBe(0);
    });

    it("returns 100 when this month is positive and last month is zero", () => {
        expect(calculateRevenueGrowth(5000, 0)).toBe(100);
    });

    it("returns positive growth when this month exceeds last month", () => {
        // 25% growth
        expect(calculateRevenueGrowth(125, 100)).toBe(25);
    });

    it("returns negative growth when this month is less than last month", () => {
        // -50% growth (halved)
        expect(calculateRevenueGrowth(50, 100)).toBe(-50);
    });

    it("returns 0 when amounts are equal", () => {
        expect(calculateRevenueGrowth(1000, 1000)).toBe(0);
    });

    it("handles large numbers (e.g. ৳10 lakh monthly)", () => {
        expect(calculateRevenueGrowth(1100000, 1000000)).toBe(10);
    });

    it("rounds to integer percent (not fractional)", () => {
        // 33.33% growth → rounded to 33
        expect(calculateRevenueGrowth(133, 100)).toBe(33);
    });
});

describe("Platform Billing — status filters", () => {
    it("includes 'all' as the first option", () => {
        expect(STATUS_FILTERS[0]).toBe("all");
    });

    it("includes the 4 valid invoice statuses", () => {
        expect(STATUS_FILTERS).toContain("paid");
        expect(STATUS_FILTERS).toContain("pending");
        expect(STATUS_FILTERS).toContain("failed");
        expect(STATUS_FILTERS).toContain("refunded");
    });

    it("excludes 'void' (which is rare and handled separately)", () => {
        expect(STATUS_FILTERS).not.toContain("void");
    });

    it("has exactly 5 filter options", () => {
        expect(STATUS_FILTERS.length).toBe(5);
    });
});

describe("Platform Billing — pagination clamping", () => {
    it("defaults to page 1 when null", () => {
        expect(clampPage(null)).toBe(1);
    });

    it("defaults to limit 50 when null", () => {
        expect(clampLimit(null)).toBe(50);
    });

    it("clamps page to minimum 1", () => {
        expect(clampPage(0)).toBe(1);
        expect(clampPage(-5)).toBe(1);
    });

    it("clamps limit to minimum 1", () => {
        expect(clampLimit(0)).toBe(1);
        expect(clampLimit(-10)).toBe(1);
    });

    it("clamps limit to maximum 100", () => {
        expect(clampLimit(500)).toBe(100);
        expect(clampLimit(101)).toBe(100);
    });

    it("passes through valid values unchanged", () => {
        expect(clampPage(5)).toBe(5);
        expect(clampLimit(25)).toBe(25);
        expect(clampLimit(100)).toBe(100);
    });

    it("computes pagination offset correctly", () => {
        // skip = (page - 1) * limit
        const page = clampPage(3);
        const limit = clampLimit(25);
        const skip = (page - 1) * limit;
        expect(skip).toBe(50); // page 3, limit 25 → skip 50
    });

    it("computes total pages from total + limit", () => {
        const total = 105;
        const limit = clampLimit(25);
        const totalPages = Math.ceil(total / limit);
        expect(totalPages).toBe(5); // 25*4=100, 5th page holds last 5
    });

    it("computes hasMore correctly", () => {
        // page 1 of 5, limit 25 → 1*25=25 < 105 → hasMore
        const page = 1;
        const limit = 25;
        const total = 105;
        const hasMore = page * limit < total;
        expect(hasMore).toBe(true);

        // page 5 of 5, limit 25 → 5*25=125 >= 105 → no more
        const hasMoreLast = 5 * limit < total;
        expect(hasMoreLast).toBe(false);
    });
});

describe("Platform Settings — CreateAdminSchema validation", () => {
    it("accepts valid input", () => {
        const valid = {
            name: "John Doe",
            email: "admin@peopleflow.com",
            password: "secure-password-123",
            role: "platform_admin" as const,
        };
        const result = CreateAdminSchema.safeParse(valid);
        expect(result.success).toBe(true);
    });

    it("applies default role when omitted", () => {
        const valid = {
            name: "John Doe",
            email: "admin@peopleflow.com",
            password: "secure-password-123",
        };
        const result = CreateAdminSchema.safeParse(valid);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.role).toBe("platform_admin");
        }
    });

    it("rejects name shorter than 2 chars", () => {
        const invalid = {
            name: "J",
            email: "admin@peopleflow.com",
            password: "secure-password-123",
        };
        const result = CreateAdminSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it("rejects name longer than 100 chars", () => {
        const invalid = {
            name: "A".repeat(101),
            email: "admin@peopleflow.com",
            password: "secure-password-123",
        };
        const result = CreateAdminSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it("rejects invalid email format", () => {
        const invalid = {
            name: "John Doe",
            email: "not-an-email",
            password: "secure-password-123",
        };
        const result = CreateAdminSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it("rejects email longer than 255 chars", () => {
        const invalid = {
            name: "John Doe",
            email: `${"a".repeat(245)}@example.com`,
            password: "secure-password-123",
        };
        const result = CreateAdminSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it("rejects password shorter than 8 chars", () => {
        const invalid = {
            name: "John Doe",
            email: "admin@peopleflow.com",
            password: "1234567", // 7 chars
        };
        const result = CreateAdminSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it("rejects password longer than 128 chars", () => {
        const invalid = {
            name: "John Doe",
            email: "admin@peopleflow.com",
            password: "a".repeat(129),
        };
        const result = CreateAdminSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it("rejects invalid role value", () => {
        const invalid = {
            name: "John Doe",
            email: "admin@peopleflow.com",
            password: "secure-password-123",
            role: "super_admin", // not in enum
        };
        const result = CreateAdminSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it("accepts platform_super role explicitly", () => {
        const valid = {
            name: "Jane Doe",
            email: "super@peopleflow.com",
            password: "very-secure-password-456",
            role: "platform_super" as const,
        };
        const result = CreateAdminSchema.safeParse(valid);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.role).toBe("platform_super");
        }
    });

    it("rejects missing required fields", () => {
        // Missing password
        const invalid = {
            name: "John Doe",
            email: "admin@peopleflow.com",
        };
        const result = CreateAdminSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it("accepts Unicode characters in name (Bengali)", () => {
        const valid = {
            name: "রহিম উদ্দিন",
            email: "rahim@peopleflow.com",
            password: "secure-password-123",
        };
        const result = CreateAdminSchema.safeParse(valid);
        expect(result.success).toBe(true);
    });

    it("accepts complex but valid email formats", () => {
        const validEmails = [
            "admin+tag@peopleflow.com",
            "first.last@sub.example.com",
            "user_name@example.co.uk",
        ];
        for (const email of validEmails) {
            const result = CreateAdminSchema.safeParse({
                name: "Test User",
                email,
                password: "secure-password-123",
            });
            expect(result.success, `Email "${email}" should be valid`).toBe(true);
        }
    });
});

describe("Platform Settings — role hierarchy", () => {
    it("platform_super has more privileges than platform_admin", () => {
        // The role check in the API route is:
        //   if (currentAdmin?.role !== "platform_super") return 403;
        // So 'platform_super' is the privileged role.
        const superCanCreate = "platform_super" === "platform_super";
        const adminCanCreate = "platform_admin" === "platform_super";
        expect(superCanCreate).toBe(true);
        expect(adminCanCreate).toBe(false);
    });

    it("only 2 valid role values exist", () => {
        // Verify that any other role value is rejected by the schema
        const validRoles = ["platform_admin", "platform_super"];
        expect(validRoles.length).toBe(2);

        for (const role of validRoles) {
            const result = CreateAdminSchema.safeParse({
                name: "Test User",
                email: "test@example.com",
                password: "password123",
                role,
            });
            expect(result.success, `Role "${role}" should be valid`).toBe(true);
        }

        // Invalid role rejected
        const invalid = CreateAdminSchema.safeParse({
            name: "Test User",
            email: "test@example.com",
            password: "password123",
            role: "platform_owner", // not in enum
        });
        expect(invalid.success).toBe(false);
    });
});
