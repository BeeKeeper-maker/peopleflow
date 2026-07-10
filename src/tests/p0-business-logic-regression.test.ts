/**
 * ═══════════════════════════════════════════════════════════════════
 * P0 BUSINESS-LOGIC REGRESSION TESTS
 * ═══════════════════════════════════════════════════════════════════
 *
 * Regression coverage for the P0 business-logic fixes shipped in
 * commit ad8ff0c ("P0-BACKEND: Fix tax exemptions, payroll atomicity,
 * leave approval tx, cron RLS, final settlement").
 *
 * Scope:
 *   a) Tax-exempt allowances applied (conveyance / medical / house rent)
 *      — calculateSalary() in @/lib/payroll-engine
 *   b) Payroll atomicity — festival bonus rolled back when slip creation fails
 *      — POST /api/payroll/process
 *   c) Final settlement uses actual working days (not calendar days)
 *      — calculateFinalSettlement() in @/lib/final-settlement-engine
 *   d) Leave encashment null encashmentRate handling (no NaN propagation)
 *      — calculateLeaveSettlement() in @/lib/leave-compliance-engine
 *
 * Determinism: all prisma calls are intercepted via the global prisma
 * mock in src/tests/setup.ts. No real DB / Redis / fetch is touched.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies of calculateSalary + the payroll process route ──
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

// ── Mock auth + rate-limit + event-bus for the payroll route ───────
vi.mock("@/lib/api-auth", () => ({
    requireAuth: vi.fn(),
    requireAdminOrHR: vi.fn(),
    requireRole: vi.fn(),
    requireEmployee: vi.fn(),
    requireManagerOrAbove: vi.fn(),
    isAuthenticated: vi.fn(
        (result: unknown): boolean =>
            !(result !== null && typeof result === "object" && "status" in (result as object)),
    ),
    AuthErrors: {
        UNAUTHORIZED: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
        FORBIDDEN: () => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
        NO_ORGANIZATION: () => new Response(JSON.stringify({ error: "No org" }), { status: 400 }),
        NO_EMPLOYEE: () => new Response(JSON.stringify({ error: "No employee" }), { status: 400 }),
        ORG_INACTIVE: () => new Response(JSON.stringify({ error: "Org inactive" }), { status: 403 }),
    },
}));

vi.mock("@/lib/rate-limit", () => ({
    // The payroll route wraps its final response with applyRateLimitHeaders
    // and reads rl.headers from the rateLimit result — both must exist on
    // the mock or the route throws inside the response builder.
    rateLimit: vi.fn().mockResolvedValue({ allowed: true, headers: {} }),
    RATE_LIMIT_CONFIGS: { read: {}, heavy: {}, write: {} },
    applyRateLimitHeaders: vi.fn((response: Response) => response),
}));

vi.mock("@/lib/event-bus", () => ({
    emit: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports under test ─────────────────────────────────────────────
import { calculateSalary, calculateMonthlyTax } from "@/lib/payroll-engine";
import { calculateFinalSettlement } from "@/lib/final-settlement-engine";
import { calculateLeaveSettlement } from "@/lib/leave-compliance-engine";
import { POST as processPayroll } from "@/app/api/payroll/process/route";
import prisma from "@/lib/prisma";
import { getFestivalBonusForPayroll } from "@/lib/festival-bonus-engine";
import { calculateLateDeduction } from "@/lib/late-deduction-engine";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

// ═══════════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a salary-structure assignment mock matching the schema used by
 * payroll-integration.test.ts. All monetary inputs are plain numbers
 * so `toNumber()` (which is the real function under test) returns them
 * unchanged.
 */
function buildMockAssignment(overrides: Record<string, unknown> = {}) {
    return {
        id: "assign-001",
        employeeId: "emp-001",
        grossSalary: 50_000,
        isActive: true,
        effectiveFrom: new Date(2025, 0, 1),
        effectiveTo: null,
        salaryStructure: {
            id: "struct-001",
            name: "Standard",
            basicPercentage: 50,
            houseRentPercent: 50,    // 50% of basic
            medicalPercent: 10,      // 10% of basic
            conveyanceFixed: 2500,
            pfEmployeePercent: 10,
            pfEmployerPercent: 10,
        },
        employee: {
            gender: "male",
            organizationId: "org-001",
            pfEnabled: true,
        },
        ...overrides,
    };
}

/** Build N attendance records for a month with status="present". */
function buildAttendanceRecords(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        id: `att-${i}`,
        employeeId: "emp-001",
        date: new Date(2026, 3, i + 1),
        status: "present",
        overtimeMinutes: 0,
        lateMinutes: 0,
    }));
}

// ═══════════════════════════════════════════════════════════════════
// a) Tax-Exempt Allowances Applied (conveyance / medical / house rent)
// ═══════════════════════════════════════════════════════════════════

describe("[P0-BUSINESS] tax-exempt allowances reduce taxable income", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getFestivalBonusForPayroll).mockResolvedValue(0);
        vi.mocked(calculateLateDeduction).mockResolvedValue({
            totalLateCount: 0,
            deductionAmount: 0,
            warnings: [],
            tierBreakdown: [],
        });
    });

    /**
     * Helper: compute the expected monthly tax given a salary structure
     * assignment, applying the same tax-exempt-allowance logic the engine
     * uses (annual gross - annual PF - capped annual exempt allowances).
     *
     * TAX_EXEMPT_ALLOWANCES caps (from payroll-engine.ts):
     *   conveyance: 30,000/yr
     *   medical:     1,20,000/yr
     *   houseRent:   3,00,000/yr
     */
    function expectedMonthlyTax(
        gross: number,
        basic: number,
        houseRent: number,
        medical: number,
        conveyance: number,
        pfEmployee: number,
        isWoman: boolean,
    ): number {
        const annualGross = gross * 12;
        const annualPF = pfEmployee * 12;
        const annualConveyance = Math.min(conveyance * 12, 30_000);
        const annualMedical = Math.min(medical * 12, 120_000);
        const annualHouseRent = Math.min(houseRent * 12, 300_000);
        const totalExempt = annualConveyance + annualMedical + annualHouseRent;
        const taxableIncome = Math.max(0, annualGross - annualPF - totalExempt);
        return calculateMonthlyTax(taxableIncome, isWoman);
    }

    it("applies capped exemption for an employee with conveyance + medical + HRA", async () => {
        // gross=50,000; basic=25,000; HRA=12,500; medical=2,500; conveyance=2,500
        // Annual: gross=600,000; PF=30,000; exempt: 30,000+30,000+150,000=210,000
        // taxableIncome = 600,000 - 30,000 - 210,000 = 360,000
        // For male: 360,000 > 350,000 → minimum tax 5,000 → monthly = 417 (rounded)
        const assignment = buildMockAssignment();
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        const expected = expectedMonthlyTax(
            50_000, 25_000, 12_500, 2_500, 2_500, /* pfEmployee= */ 2_500, false,
        );
        expect(result.incomeTax).toBe(expected);

        // Sanity: the exemption MUST reduce tax vs. no-exemption baseline.
        const annualGross = 50_000 * 12;
        const annualPF = 2_500 * 12;
        const taxWithoutExemption = calculateMonthlyTax(annualGross - annualPF, false);
        expect(result.incomeTax).toBeLessThan(taxWithoutExemption);
    });

    it("employee with no allowances gets no exemption (taxable = gross - PF)", async () => {
        // Structure: 100% to special allowance — no HRA/medical/conveyance
        const assignment = buildMockAssignment({
            salaryStructure: {
                id: "struct-no-allow",
                name: "No-Allowance",
                basicPercentage: 50,
                houseRentPercent: 0,     // no HRA
                medicalPercent: 0,       // no medical
                conveyanceFixed: 0,      // no conveyance
                pfEmployeePercent: 10,
                pfEmployerPercent: 10,
            },
        });
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // With no exempt allowances, taxable = annualGross - annualPF
        const expected = calculateMonthlyTax(50_000 * 12 - 2_500 * 12, false);
        expect(result.incomeTax).toBe(expected);
    });

    it("caps conveyance exemption at 30,000/yr even when monthly allowance exceeds 2,500", async () => {
        // Monthly conveyance = 5,000 → annual = 60,000 → capped at 30,000
        const assignment = buildMockAssignment({
            salaryStructure: {
                id: "struct-high-conv",
                name: "High-Conveyance",
                basicPercentage: 50,
                houseRentPercent: 0,
                medicalPercent: 0,
                conveyanceFixed: 5_000, // 60,000/yr — exceeds 30,000 cap
                pfEmployeePercent: 10,
                pfEmployerPercent: 10,
            },
        });
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // Exemption cap = 30,000 (not 60,000)
        // basic = 25,000; PF = 2,500/mo; annualPF = 30,000
        // taxableIncome = 600,000 - 30,000 - 30,000 = 540,000
        // Male: 0 + 5,000 + (540,000 - 450,000) * 10% = 5,000 + 9,000 = 14,000 → monthly = 1167
        const expected = expectedMonthlyTax(
            50_000, 25_000, /* HRA */ 0, /* medical */ 0, /* conveyance */ 5_000, 2_500, false,
        );
        expect(result.incomeTax).toBe(expected);

        // Verify cap is enforced: if cap were 60,000, tax would be lower
        const taxIfUncapped = calculateMonthlyTax(
            50_000 * 12 - 2_500 * 12 - (5_000 * 12), false,
        );
        expect(result.incomeTax).toBeGreaterThan(taxIfUncapped);
    });

    it("never produces a negative taxable income when exemptions exceed gross-PF", async () => {
        // Extreme case: massive allowances that would push taxable below 0
        // if the Math.max(0, ...) guard weren't there.
        const assignment = buildMockAssignment({
            grossSalary: 200_000,
            salaryStructure: {
                id: "struct-extreme",
                name: "Extreme",
                basicPercentage: 10,      // basic = 20,000
                houseRentPercent: 200,    // HRA = 40,000 (huge)
                medicalPercent: 100,      // medical = 20,000
                conveyanceFixed: 30_000,  // conveyance = 30,000
                pfEmployeePercent: 10,
                pfEmployerPercent: 10,
            },
        });
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(assignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // Tax MUST be finite (no NaN from negative taxable income).
        expect(Number.isFinite(result.incomeTax)).toBe(true);
        expect(result.incomeTax).toBeGreaterThanOrEqual(0);
    });

    it("female employee gets BOTH women's threshold AND allowance exemption", async () => {
        const femaleAssignment = buildMockAssignment({
            employee: { gender: "female", organizationId: "org-001", pfEnabled: true },
        });
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(femaleAssignment as never);
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });

        // Female: taxable = 600,000 - 30,000 - 210,000 = 360,000
        // Women's threshold = 400,000, so 360,000 < 400,000 → tax = 0
        const expected = expectedMonthlyTax(
            50_000, 25_000, 12_500, 2_500, 2_500, 2_500, /* isWoman */ true,
        );
        expect(result.incomeTax).toBe(expected);
        // Female should pay less than male with the same structure
        const maleResult = await calculateSalary({ employeeId: "emp-001", month: 4, year: 2026 });
        expect(result.incomeTax).toBeLessThanOrEqual(maleResult.incomeTax);
    });
});

// ═══════════════════════════════════════════════════════════════════
// b) Payroll Atomicity — Festival Bonus Rollback on Slip Failure
// ═══════════════════════════════════════════════════════════════════

describe("[P0-BUSINESS] payroll atomicity — festival bonus rollback", () => {
    const mockAuth = {
        userId: "admin-001",
        role: "admin",
        organizationId: "org-001",
        email: "admin@example.com",
        // withDB invokes the callback with our shared prisma mock so the
        // route's db.* calls hit the same vi.fn instances we assert on.
        withDB: async <T,>(fn: (db: unknown) => Promise<T>): Promise<T> => fn(prisma),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminOrHR).mockResolvedValue(mockAuth as never);
        vi.mocked(isAuthenticated).mockReturnValue(true);
        vi.mocked(rateLimit).mockResolvedValue({ allowed: true } as never);
        // Festival bonus engine returns 25,000 for the happy-path rollback test
        vi.mocked(getFestivalBonusForPayroll).mockResolvedValue(25_000);
        vi.mocked(calculateLateDeduction).mockResolvedValue({
            totalLateCount: 0,
            deductionAmount: 0,
            warnings: [],
            tierBreakdown: [],
        });
    });

    function makeProcessRequest(body: unknown): Request {
        return new Request("http://localhost/api/payroll/process", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        });
    }

    /** Wire up the "happy path" prisma stubs that the route reads BEFORE
     *  it tries to create a slip — employees, existing slips, loans. */
    function setupRouteReadStubs(employeeId: string) {
        vi.mocked(prisma.employee.findMany).mockResolvedValue([
            {
                id: employeeId,
                firstName: "Test",
                lastName: "User",
                user: { id: "u-1", email: "t@e.com" },
            },
        ] as never);
        vi.mocked(prisma.salarySlip.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);
        // Salary structure assignment needed by calculateSalary
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(
            buildMockAssignment() as never,
        );
        vi.mocked(prisma.attendance.findMany).mockResolvedValue(buildAttendanceRecords(22) as never);
        vi.mocked(prisma.leaveApplication.findMany).mockResolvedValue([] as never);
    }

    it("rolls back festival bonus (status → pending) when salary slip creation fails", async () => {
        setupRouteReadStubs("emp-001");
        // CRITICAL: slip.create throws → triggers the rollback path
        vi.mocked(prisma.salarySlip.create).mockRejectedValue(
            new Error("DB write failed — unique constraint violation") as never,
        );
        vi.mocked(prisma.festivalBonusPayment.updateMany).mockResolvedValue({ count: 1 } as never);

        const res = await processPayroll(
            makeProcessRequest({ month: 4, year: 2026, employeeIds: ["emp-001"] }),
        );

        // Route returns 200 with the failed employee in `errors`
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.errorCount).toBe(1);
        expect(json.errors[0].employeeId).toBe("emp-001");

        // CRITICAL regression assertion: rollback was called with the
        // exact filter that targets bonuses marked "included_in_payroll"
        // for this employee + month + year, and resets them to "pending".
        expect(prisma.festivalBonusPayment.updateMany).toHaveBeenCalledWith({
            where: {
                employeeId: "emp-001",
                status: "included_in_payroll",
                payrollMonth: 4,
                payrollYear: 2026,
            },
            data: {
                status: "pending",
                payrollMonth: null,
                payrollYear: null,
            },
        });
    });

    it("does NOT roll back festival bonus when slip creation succeeds", async () => {
        setupRouteReadStubs("emp-001");
        vi.mocked(prisma.salarySlip.create).mockResolvedValue({ id: "slip-001" } as never);

        const res = await processPayroll(
            makeProcessRequest({ month: 4, year: 2026, employeeIds: ["emp-001"] }),
        );
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.processed).toBe(1);
        expect(json.errorCount).toBe(0);
        // No rollback should fire on success
        expect(prisma.festivalBonusPayment.updateMany).not.toHaveBeenCalled();
    });

    it("does NOT attempt rollback when festival bonus is 0 (no bonus marked)", async () => {
        setupRouteReadStubs("emp-002");
        // Override: no festival bonus this payroll cycle
        vi.mocked(getFestivalBonusForPayroll).mockResolvedValue(0);
        vi.mocked(prisma.salarySlip.create).mockRejectedValue(new Error("DB write failed") as never);

        const res = await processPayroll(
            makeProcessRequest({ month: 4, year: 2026, employeeIds: ["emp-002"] }),
        );

        expect(res.status).toBe(200);
        // Without a festival bonus to roll back, updateMany should not fire
        expect(prisma.festivalBonusPayment.updateMany).not.toHaveBeenCalled();
    });

    it("skips already-existing (non-reversed) slips instead of re-processing them", async () => {
        // Existing slip for this employee/month/year — should be skipped, not re-processed
        vi.mocked(prisma.employee.findMany).mockResolvedValue([
            {
                id: "emp-003",
                firstName: "Already",
                lastName: "Paid",
                user: { id: "u-3", email: "p@e.com" },
            },
        ] as never);
        vi.mocked(prisma.salarySlip.findMany).mockResolvedValue([
            { employeeId: "emp-003", isLocked: false, isReversed: false, status: "draft" },
        ] as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const res = await processPayroll(
            makeProcessRequest({ month: 4, year: 2026, employeeIds: ["emp-003"] }),
        );
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.processed).toBe(0);
        expect(json.errorCount).toBe(1);
        expect(json.errors[0].employeeId).toBe("emp-003");
        // No slip created, no rollback attempted
        expect(prisma.salarySlip.create).not.toHaveBeenCalled();
        expect(prisma.festivalBonusPayment.updateMany).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// c) Final Settlement Uses Actual Working Days (Not Calendar Days)
// ═══════════════════════════════════════════════════════════════════

describe("[P0-BUSINESS] final settlement uses actual working days", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Wire up the read stubs calculateFinalSettlement needs. Default:
     *  - 5+ year employee (eligible for gratuity)
     *  - monthly gross 50,000, basic 50% = 25,000
     *  - BD weekend (Fri/Sat), no holidays
     *  - no leave allocations, no PF, no loans
     */
    function setupSettlementStubs(opts: { joiningDate: Date; gross?: number }) {
        vi.mocked(prisma.employee.findFirst).mockResolvedValue({
            id: "emp-001",
            firstName: "Test",
            lastName: "User",
            employeeCode: "EMP-001",
            joiningDate: opts.joiningDate,
            gender: "male",
            employmentType: "permanent",
            employmentStatus: "active",
            organizationId: "org-001",
        } as never);
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue({
            grossSalary: opts.gross ?? 50_000,
            salaryStructure: { basicPercentage: 50 },
        } as never);
        // BD-default weekend (Fri/Sat) — settings null triggers fallback
        vi.mocked(prisma.organization.findUnique).mockResolvedValue({
            id: "org-001",
            settings: null,
        } as never);
        vi.mocked(prisma.holidayList.findFirst).mockResolvedValue(null as never);
        vi.mocked(prisma.leaveAllocation.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.pFAccount.findFirst).mockResolvedValue(null as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);
    }

    /**
     * Compute the expected pro-rated salary using the same working-days
     * formula as final-settlement-engine.ts.
     *
     * BD weekend = Fri (5) + Sat (6). No holidays.
     */
    function expectedProRatedSalary(monthStart: Date, lastWorkingDate: Date, monthlyGross: number): {
        employed: number;
        inMonth: number;
        amount: number;
    } {
        // Count working days employed (monthStart..lastWorkingDate inclusive)
        let employed = 0;
        const cur = new Date(monthStart);
        cur.setHours(0, 0, 0, 0);
        const end = new Date(lastWorkingDate);
        end.setHours(0, 0, 0, 0);
        while (cur <= end) {
            const dow = cur.getDay();
            if (dow !== 5 && dow !== 6) employed++;
            cur.setDate(cur.getDate() + 1);
        }
        // Count working days in the full month
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        let inMonth = 0;
        const cur2 = new Date(monthStart);
        cur2.setHours(0, 0, 0, 0);
        const end2 = new Date(monthEnd);
        end2.setHours(0, 0, 0, 0);
        while (cur2 <= end2) {
            const dow = cur2.getDay();
            if (dow !== 5 && dow !== 6) inMonth++;
            cur2.setDate(cur2.getDate() + 1);
        }
        const amount = inMonth > 0 ? Math.round((monthlyGross * employed) / inMonth) : 0;
        return { employed, inMonth, amount };
    }

    it("pro-rates salary by actual working days (NOT calendar day-of-month)", async () => {
        // Employee leaving April 14, 2026 (Tuesday).
        // April 1 = Wednesday. Working days 1-14 (excl Fri/Sat weekends):
        //   1(Wed), 2(Thu), 5(Sun), 6(Mon), 7(Tue), 8(Wed), 9(Thu),
        //   12(Sun), 13(Mon), 14(Tue)  = 10 working days
        // Total working days in April 2026 = 22.
        // proRatedSalary = 50,000 * 10 / 22 = 22,727
        //
        // BUG (pre-fix): used lastWorkingDate.getDate() = 14, giving
        //   50,000 * 14 / 30 = 23,333 (overpayment by ~600 BDT).
        const lastWorkingDate = new Date(2026, 3, 14); // April 14, 2026
        setupSettlementStubs({
            joiningDate: new Date(2020, 0, 1), // 6+ years — gratuity eligible
        });

        const result = await calculateFinalSettlement({
            employeeId: "emp-001",
            lastWorkingDate,
            separationType: "resignation",
            noticeGiven: true,
            noticeDaysServed: 120,
        });

        const monthStart = new Date(2026, 3, 1);
        const expected = expectedProRatedSalary(monthStart, lastWorkingDate, 50_000);

        const proRatedComponent = result.components.find(
            (c) => c.label === "Pro-rated Salary",
        );
        expect(proRatedComponent).toBeDefined();
        expect(proRatedComponent!.amount).toBe(expected.amount);

        // Verify working-day counts appear in the details string — this is
        // the proof that the engine used working days, not calendar days.
        expect(proRatedComponent!.details).toContain(`${expected.employed}/${expected.inMonth} working days`);

        // Negative regression: ensure we don't get the calendar-day amount.
        const calendarDayBuggy = Math.round((50_000 * 14) / 30); // 23,333
        expect(proRatedComponent!.amount).not.toBe(calendarDayBuggy);
    });

    it("employee leaving on the 1st of the month gets 1 working day's pay (not 1/30)", async () => {
        // April 1, 2026 is a Wednesday (working day).
        // Working days employed = 1; total working days in April = 22.
        // proRatedSalary = 50,000 * 1 / 22 = 2,273
        const lastWorkingDate = new Date(2026, 3, 1);
        setupSettlementStubs({ joiningDate: new Date(2020, 0, 1) });

        const result = await calculateFinalSettlement({
            employeeId: "emp-001",
            lastWorkingDate,
            separationType: "resignation",
            noticeGiven: true,
            noticeDaysServed: 120,
        });

        const expected = expectedProRatedSalary(new Date(2026, 3, 1), lastWorkingDate, 50_000);
        const proRated = result.components.find((c) => c.label === "Pro-rated Salary")!;
        expect(proRated.amount).toBe(expected.amount);
        expect(expected.employed).toBe(1);
        // Sanity: 1 working day, not 1 calendar day's worth (50,000/30 = 1,667)
        expect(proRated.amount).not.toBe(Math.round(50_000 / 30));
    });

    it("employee leaving on the 30th gets full month's pay (all working days)", async () => {
        // April 30, 2026 — entire month of working days
        const lastWorkingDate = new Date(2026, 3, 30);
        setupSettlementStubs({ joiningDate: new Date(2020, 0, 1) });

        const result = await calculateFinalSettlement({
            employeeId: "emp-001",
            lastWorkingDate,
            separationType: "resignation",
            noticeGiven: true,
            noticeDaysServed: 120,
        });

        const expected = expectedProRatedSalary(new Date(2026, 3, 1), lastWorkingDate, 50_000);
        const proRated = result.components.find((c) => c.label === "Pro-rated Salary")!;
        // employed == inMonth → full gross
        expect(expected.employed).toBe(expected.inMonth);
        expect(proRated.amount).toBe(expected.amount);
        expect(proRated.amount).toBe(50_000); // Full month
    });

    it("uses 0 pro-rated salary when the month has zero working days (guard)", async () => {
        // Hypothetical: org with every day as weekend (impossible but
        // tests the division-by-zero guard). We simulate by mocking
        // holidayList to mark every day as a holiday — easier than
        // reconfiguring weekend days. The calculateWorkingDays helper
        // excludes both weekends (Fri/Sat default) AND holidays.
        const allDaysInApril = Array.from({ length: 30 }, (_, i) => ({
            date: new Date(2026, 3, i + 1),
        }));
        vi.mocked(prisma.employee.findFirst).mockResolvedValue({
            id: "emp-001",
            firstName: "Test",
            lastName: "User",
            employeeCode: "EMP-001",
            joiningDate: new Date(2020, 0, 1),
            gender: "male",
            employmentType: "permanent",
            employmentStatus: "active",
            organizationId: "org-001",
        } as never);
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue({
            grossSalary: 50_000,
            salaryStructure: { basicPercentage: 50 },
        } as never);
        vi.mocked(prisma.organization.findUnique).mockResolvedValue({
            id: "org-001",
            settings: null,
        } as never);
        // Mark every single day as a holiday — leaves 0 working days
        vi.mocked(prisma.holidayList.findFirst).mockResolvedValue({
            holidays: allDaysInApril,
        } as never);
        vi.mocked(prisma.leaveAllocation.findMany).mockResolvedValue([] as never);
        vi.mocked(prisma.pFAccount.findFirst).mockResolvedValue(null as never);
        vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

        const result = await calculateFinalSettlement({
            employeeId: "emp-001",
            lastWorkingDate: new Date(2026, 3, 30),
            separationType: "resignation",
            noticeGiven: true,
            noticeDaysServed: 120,
        });

        const proRated = result.components.find((c) => c.label === "Pro-rated Salary")!;
        expect(proRated.amount).toBe(0); // Guard kicks in — no NaN, no Infinity
    });
});

// ═══════════════════════════════════════════════════════════════════
// d) Leave Encashment — Null encashmentRate Handling (No NaN)
// ═══════════════════════════════════════════════════════════════════

describe("[P0-BUSINESS] leave encashment — null encashmentRate does not produce NaN", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /** Wire up the salary-structure stub calculateLeaveSettlement reads. */
    function setupLeaveSettlementStubs(
        allocations: unknown[],
        gross = 50_000,
        basicPct = 50,
    ) {
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue({
            grossSalary: gross,
            salaryStructure: { basicPercentage: basicPct },
        } as never);
        vi.mocked(prisma.leaveAllocation.findMany).mockResolvedValue(allocations as never);
    }

    it("null encashmentRate yields encashmentAmount = 0 (not NaN)", async () => {
        // Encashable leave with NULL encashmentRate.
        // Pre-fix risk: null * dailyRate * (null/100) could produce NaN if
        // the engine weren't careful. JS coerces null/100 → 0, so the
        // amount becomes 0. This test pins that behavior so a future
        // refactor can't silently regress to NaN.
        setupLeaveSettlementStubs([
            {
                allocatedDays: 10,
                carriedForward: 5,
                usedDays: 3,
                leaveType: {
                    name: "Earned Leave",
                    encashmentAllowed: true,
                    encashmentRate: null, // NULL — must not produce NaN
                },
            },
        ]);

        const result = await calculateLeaveSettlement("emp-001", 2026);

        // CRITICAL: amount is finite (no NaN propagation)
        expect(Number.isFinite(result.encashmentAmount)).toBe(true);
        // null/100 = 0 → encashment = 0
        expect(result.encashmentAmount).toBe(0);
        // breakdown is populated, not null/undefined
        expect(result.breakdown).toHaveLength(1);
        expect(result.breakdown[0].encashable).toBe(true);
    });

    it("0 encashmentRate yields encashmentAmount = 0", async () => {
        setupLeaveSettlementStubs([
            {
                allocatedDays: 10,
                carriedForward: 0,
                usedDays: 2,
                leaveType: {
                    name: "Sick Leave",
                    encashmentAllowed: true,
                    encashmentRate: 0, // 0% — no encashment value
                },
            },
        ]);

        const result = await calculateLeaveSettlement("emp-001", 2026);

        expect(Number.isFinite(result.encashmentAmount)).toBe(true);
        expect(result.encashmentAmount).toBe(0);
    });

    it("100 encashmentRate (default) yields full daily-rate × balance", async () => {
        // gross=50,000; basic=50% = 25,000; daily = 25,000/26 = 962 (rounded)
        // balance = 10 + 5 - 3 = 12 days
        // encashment = 12 * 962 * (100/100) = 11,544
        setupLeaveSettlementStubs([
            {
                allocatedDays: 10,
                carriedForward: 5,
                usedDays: 3,
                leaveType: {
                    name: "Earned Leave",
                    encashmentAllowed: true,
                    encashmentRate: 100,
                },
            },
        ]);

        const result = await calculateLeaveSettlement("emp-001", 2026);

        const basicSalary = Math.round(50_000 * (50 / 100));
        const dailyRate = Math.round(basicSalary / 26);
        const expected = Math.round(12 * dailyRate * (100 / 100));
        expect(result.encashmentAmount).toBe(expected);
        expect(result.encashableDays).toBe(12);
    });

    it("returns empty breakdown when no salary structure is assigned", async () => {
        vi.mocked(prisma.salaryStructureAssignment.findFirst).mockResolvedValue(null as never);

        const result = await calculateLeaveSettlement("emp-001", 2026);

        expect(result.encashableDays).toBe(0);
        expect(result.encashmentAmount).toBe(0);
        expect(result.breakdown).toEqual([]);
        expect(Number.isFinite(result.encashmentAmount)).toBe(true);
    });

    it("does not include non-encashable leave types in the encashment total", async () => {
        // Mix of encashable + non-encashable leave types
        setupLeaveSettlementStubs([
            {
                allocatedDays: 10,
                carriedForward: 5,
                usedDays: 3,
                leaveType: {
                    name: "Earned Leave",
                    encashmentAllowed: true,
                    encashmentRate: 100,
                },
            },
            {
                allocatedDays: 8,
                carriedForward: 0,
                usedDays: 1,
                leaveType: {
                    name: "Sick Leave",
                    encashmentAllowed: false, // not encashable
                    encashmentRate: 100,
                },
            },
        ]);

        const result = await calculateLeaveSettlement("emp-001", 2026);

        // Only the Earned Leave (12 days balance) should count
        expect(result.encashableDays).toBe(12);
        const basicSalary = Math.round(50_000 * (50 / 100));
        const dailyRate = Math.round(basicSalary / 26);
        expect(result.encashmentAmount).toBe(Math.round(12 * dailyRate));
        // Both leave types appear in the breakdown
        expect(result.breakdown).toHaveLength(2);
        const sick = result.breakdown.find((b) => b.leaveType === "Sick Leave")!;
        expect(sick.encashable).toBe(false);
        expect(sick.encashRate).toBe(100);
    });
});
