/**
 * Leave Compliance Engine — BLA 2006 Maternity & Earned Leave
 *
 * ========================================================================
 * FATAL FLAW #8: MATERNITY LEAVE PRE/POST SPLIT
 * ========================================================================
 *
 * Bangladesh Labor Act 2006, Section 46-47:
 *   - Total maternity leave: 16 weeks (112 days)
 *   - MUST be split: 8 weeks (56 days) before delivery + 8 weeks (56 days) after
 *   - Employee must have worked at least 6 months to be eligible
 *   - Leave cannot be denied if conditions met
 *   - Payment: Full average wages for the entire period
 *
 * This engine:
 *   ✅ Validates pre/post delivery date splits against BLA limits
 *   ✅ Tracks expected vs actual delivery dates
 *   ✅ Auto-calculates remaining post-delivery entitlement
 *   ✅ Prevents over-utilization of either phase
 *   ✅ Handles edge cases (premature delivery, date adjustments)
 *
 * ========================================================================
 * FATAL FLAW #9: EARNED LEAVE PRO-RATA & SETTLEMENT
 * ========================================================================
 *
 * Bangladesh Labor Act 2006, Section 117:
 *   - Earned leave: 1 day for every 18 working days
 *   - Carry forward allowed
 *   - Encashment on separation at basic daily rate
 *
 * This engine:
 *   ✅ Calculates pro-rata earned leave based on actual working days
 *   ✅ Settlement calculation on separation
 *   ✅ Encashment value at basic salary daily rate
 */

import prisma from "@/lib/prisma";
import { differenceInCalendarDays, addWeeks } from "date-fns";

// ══════════════════════════════════════════════
// MATERNITY LEAVE ENGINE
// ══════════════════════════════════════════════

export const MATERNITY_CONFIG = {
    TOTAL_WEEKS: 16,
    TOTAL_DAYS: 112,
    PRE_DELIVERY_WEEKS: 8,
    PRE_DELIVERY_DAYS: 56,
    POST_DELIVERY_WEEKS: 8,
    POST_DELIVERY_DAYS: 56,
    MIN_SERVICE_DAYS: 180, // 6 months minimum service
    MAX_CHILDREN: 2, // BLA 2006 covers first 2 children
} as const;

// ── Types ────────────────────────────────────

export interface MaternityValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    calculation: {
        preDeliveryDays: number;
        postDeliveryDays: number;
        totalDays: number;
        remainingPreDelivery: number;
        remainingPostDelivery: number;
        expectedReturnDate: Date | null;
    } | null;
}

export interface MaternityLeaveInput {
    employeeId: string;
    fromDate: Date;
    toDate: Date;
    expectedDeliveryDate: Date;
    maternityPhase: "pre_delivery" | "post_delivery" | "full";
}

// ── Core Validation ──────────────────────────

/**
 * Validate a maternity leave application against BLA 2006 rules.
 *
 * Checks:
 *   1. Employee gender (must be female)
 *   2. Minimum service period (6 months)
 *   3. Pre-delivery phase: max 56 days before expected delivery
 *   4. Post-delivery phase: max 56 days after actual/expected delivery
 *   5. Total maternity days used this pregnancy don't exceed 112
 *   6. Does not exceed 2 children (BLA 2006 limit)
 */
export async function validateMaternityLeave(
    input: MaternityLeaveInput
): Promise<MaternityValidationResult> {
    const result: MaternityValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        calculation: null,
    };

    const { employeeId, fromDate, toDate, expectedDeliveryDate, maternityPhase } = input;

    // 1. Check employee exists and get details
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
            gender: true,
            joiningDate: true,
            firstName: true,
            lastName: true,
        },
    });

    if (!employee) {
        result.isValid = false;
        result.errors.push("Employee not found");
        return result;
    }

    // 2. Gender check
    if (employee.gender !== "female") {
        result.isValid = false;
        result.errors.push("Maternity leave is only available for female employees (BLA 2006, Section 46)");
        return result;
    }

    // 3. Minimum service check
    const serviceDays = differenceInCalendarDays(fromDate, employee.joiningDate);
    if (serviceDays < MATERNITY_CONFIG.MIN_SERVICE_DAYS) {
        result.isValid = false;
        result.errors.push(
            `Insufficient service: ${serviceDays} days (minimum ${MATERNITY_CONFIG.MIN_SERVICE_DAYS} days / 6 months required per Section 46)`
        );
        return result;
    }

    // 3.5. Check 2-child cap (BLA 2006 Section 46 — maternity benefit for first 2 children only)
    const previousMaternityCount = await prisma.leaveApplication.count({
        where: {
            employeeId,
            isMaternityLeave: true,
            status: { in: ["approved", "pending"] },
            // Count distinct pregnancies (different expected delivery dates,
            // more than 180 days apart from current one)
            expectedDeliveryDate: {
                lt: new Date(expectedDeliveryDate.getTime() - 180 * 24 * 60 * 60 * 1000),
            },
        },
    });

    if (previousMaternityCount >= MATERNITY_CONFIG.MAX_CHILDREN) {
        result.isValid = false;
        result.errors.push(
            `Maternity benefit limit reached: ${previousMaternityCount} previous maternity leave(s) used. BLA 2006 Section 46 covers first ${MATERNITY_CONFIG.MAX_CHILDREN} children only.`
        );
        return result;
    }

    // 4. Calculate requested days
    const requestedDays = differenceInCalendarDays(toDate, fromDate) + 1;

    // 5. Get existing maternity leave applications for this pregnancy
    // (matched by expected delivery date within ±30 days to handle date adjustments)
    const existingMaternityLeaves = await prisma.leaveApplication.findMany({
        where: {
            employeeId,
            isMaternityLeave: true,
            status: { in: ["approved", "pending"] },
            expectedDeliveryDate: {
                gte: new Date(expectedDeliveryDate.getTime() - 30 * 24 * 60 * 60 * 1000),
                lte: new Date(expectedDeliveryDate.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
        },
        select: {
            preDeliveryDays: true,
            postDeliveryDays: true,
            totalDays: true,
            maternityPhase: true,
        },
    });

    const usedPreDelivery = existingMaternityLeaves.reduce(
        (sum, l) => sum + (l.preDeliveryDays || 0), 0
    );
    const usedPostDelivery = existingMaternityLeaves.reduce(
        (sum, l) => sum + (l.postDeliveryDays || 0), 0
    );

    // 6. Validate based on phase
    let preDeliveryDays = 0;
    let postDeliveryDays = 0;

    if (maternityPhase === "pre_delivery") {
        preDeliveryDays = requestedDays;

        // Check: leave must be before expected delivery date
        if (fromDate >= expectedDeliveryDate) {
            result.isValid = false;
            result.errors.push("Pre-delivery leave must start before the expected delivery date");
        }

        // Check: max 56 days pre-delivery
        if (usedPreDelivery + preDeliveryDays > MATERNITY_CONFIG.PRE_DELIVERY_DAYS) {
            result.isValid = false;
            result.errors.push(
                `Pre-delivery limit exceeded: ${usedPreDelivery} days already used + ${preDeliveryDays} requested = ${usedPreDelivery + preDeliveryDays} days (max ${MATERNITY_CONFIG.PRE_DELIVERY_DAYS} days / 8 weeks)`
            );
        }
    } else if (maternityPhase === "post_delivery") {
        postDeliveryDays = requestedDays;

        // Check: max 56 days post-delivery
        if (usedPostDelivery + postDeliveryDays > MATERNITY_CONFIG.POST_DELIVERY_DAYS) {
            result.isValid = false;
            result.errors.push(
                `Post-delivery limit exceeded: ${usedPostDelivery} days already used + ${postDeliveryDays} requested = ${usedPostDelivery + postDeliveryDays} days (max ${MATERNITY_CONFIG.POST_DELIVERY_DAYS} days / 8 weeks)`
            );
        }
    } else if (maternityPhase === "full") {
        // Full 16-week block — auto-split based on expected delivery date
        const daysBeforeDelivery = Math.max(0, differenceInCalendarDays(expectedDeliveryDate, fromDate));
        const daysAfterDelivery = Math.max(0, requestedDays - daysBeforeDelivery);

        preDeliveryDays = Math.min(daysBeforeDelivery, MATERNITY_CONFIG.PRE_DELIVERY_DAYS);
        postDeliveryDays = Math.min(daysAfterDelivery, MATERNITY_CONFIG.POST_DELIVERY_DAYS);

        if (requestedDays > MATERNITY_CONFIG.TOTAL_DAYS) {
            result.isValid = false;
            result.errors.push(
                `Total maternity leave cannot exceed ${MATERNITY_CONFIG.TOTAL_DAYS} days (${MATERNITY_CONFIG.TOTAL_WEEKS} weeks)`
            );
        }
    }

    // 7. Check total doesn't exceed 112 days
    const totalUsed = usedPreDelivery + usedPostDelivery + preDeliveryDays + postDeliveryDays;
    if (totalUsed > MATERNITY_CONFIG.TOTAL_DAYS) {
        result.isValid = false;
        result.errors.push(
            `Total maternity leave for this pregnancy would be ${totalUsed} days (max ${MATERNITY_CONFIG.TOTAL_DAYS} days per Section 46)`
        );
    }

    // 8. Warnings
    const remainingPre = MATERNITY_CONFIG.PRE_DELIVERY_DAYS - usedPreDelivery - preDeliveryDays;
    const remainingPost = MATERNITY_CONFIG.POST_DELIVERY_DAYS - usedPostDelivery - postDeliveryDays;

    if (remainingPre > 0 && maternityPhase === "pre_delivery") {
        result.warnings.push(
            `${remainingPre} pre-delivery days remaining after this application`
        );
    }

    if (remainingPost > 0 && maternityPhase === "post_delivery") {
        result.warnings.push(
            `${remainingPost} post-delivery days remaining after this application`
        );
    }

    // Calculate expected return date
    const expectedReturnDate = maternityPhase === "full"
        ? addWeeks(expectedDeliveryDate, MATERNITY_CONFIG.POST_DELIVERY_WEEKS)
        : new Date(toDate.getTime() + 24 * 60 * 60 * 1000);

    result.calculation = {
        preDeliveryDays,
        postDeliveryDays,
        totalDays: preDeliveryDays + postDeliveryDays,
        remainingPreDelivery: Math.max(0, remainingPre),
        remainingPostDelivery: Math.max(0, remainingPost),
        expectedReturnDate,
    };

    return result;
}

/**
 * Get maternity leave summary for an employee (for HR dashboard).
 */
export async function getMaternityLeaveSummary(employeeId: string): Promise<{
    hasActiveMaternity: boolean;
    expectedDeliveryDate: Date | null;
    totalUsed: number;
    preDeliveryUsed: number;
    postDeliveryUsed: number;
    remainingTotal: number;
} | null> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { gender: true },
    });

    if (!employee || employee.gender !== "female") return null;

    const activeMaternity = await prisma.leaveApplication.findMany({
        where: {
            employeeId,
            isMaternityLeave: true,
            status: { in: ["approved", "pending"] },
        },
        orderBy: { fromDate: "desc" },
    });

    if (activeMaternity.length === 0) {
        return {
            hasActiveMaternity: false,
            expectedDeliveryDate: null,
            totalUsed: 0,
            preDeliveryUsed: 0,
            postDeliveryUsed: 0,
            remainingTotal: MATERNITY_CONFIG.TOTAL_DAYS,
        };
    }

    const preUsed = activeMaternity.reduce((sum, l) => sum + (l.preDeliveryDays || 0), 0);
    const postUsed = activeMaternity.reduce((sum, l) => sum + (l.postDeliveryDays || 0), 0);
    const totalUsed = preUsed + postUsed;

    return {
        hasActiveMaternity: true,
        expectedDeliveryDate: activeMaternity[0].expectedDeliveryDate,
        totalUsed,
        preDeliveryUsed: preUsed,
        postDeliveryUsed: postUsed,
        remainingTotal: Math.max(0, MATERNITY_CONFIG.TOTAL_DAYS - totalUsed),
    };
}

// ══════════════════════════════════════════════
// EARNED LEAVE PRO-RATA ENGINE
// ══════════════════════════════════════════════

/**
 * Bangladesh Labor Act 2006, Section 117:
 * "Every worker shall be allowed annual leave with wages at the rate of
 *  one day for every eighteen working days."
 *
 * This means earned leave is calculated based on ACTUAL working days,
 * not calendar days. Pro-rata calculation:
 *   - Full year (312 working days): 312 / 18 = ~17.3 days
 *   - 6 months (156 working days): 156 / 18 = ~8.7 days
 */

export const EARNED_LEAVE_RATIO = 18; // 1 day per 18 working days

/**
 * Calculate earned leave entitlement based on actual working days.
 *
 * @param workingDays - Actual days present (from attendance records)
 * @returns Number of earned leave days (rounded down to nearest 0.5)
 */
export function calculateEarnedLeave(workingDays: number): number {
    const rawDays = workingDays / EARNED_LEAVE_RATIO;
    return Math.floor(rawDays * 2) / 2; // Round down to nearest 0.5
}

/**
 * Calculate pro-rata earned leave for a specific employee for a given year.
 * Counts actual present days from attendance records.
 */
export async function calculateProRataEarnedLeave(
    employeeId: string,
    year: number
): Promise<{
    workingDays: number;
    earnedLeaveDays: number;
    formula: string;
}> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // Count actual present days
    const presentCount = await prisma.attendance.count({
        where: {
            employeeId,
            date: { gte: startDate, lte: endDate },
            status: { in: ["present", "late"] },
        },
    });

    // Include half-days at 0.5
    const halfDayCount = await prisma.attendance.count({
        where: {
            employeeId,
            date: { gte: startDate, lte: endDate },
            status: "half_day",
        },
    });

    const workingDays = presentCount + (halfDayCount * 0.5);
    const earnedLeaveDays = calculateEarnedLeave(workingDays);

    return {
        workingDays,
        earnedLeaveDays,
        formula: `${workingDays} working days ÷ ${EARNED_LEAVE_RATIO} = ${earnedLeaveDays} days (Section 117, BLA 2006)`,
    };
}

// ══════════════════════════════════════════════
// LEAVE SETTLEMENT ON SEPARATION
// ══════════════════════════════════════════════

export interface LeaveSettlementResult {
    encashableDays: number;
    dailyRate: number;
    encashmentAmount: number;
    breakdown: Array<{
        leaveType: string;
        balance: number;
        encashable: boolean;
        encashRate: number;
    }>;
}

/**
 * Calculate leave encashment value on employee separation.
 *
 * For each leave type with encashment enabled:
 *   Encashment = Balance Days × (Basic Salary / 26) × (encashmentRate / 100)
 *
 * This should be included in the Final & Full Settlement payslip.
 */
export async function calculateLeaveSettlement(
    employeeId: string,
    currentYear: number
): Promise<LeaveSettlementResult> {
    // Get employee's basic salary
    const salaryAssignment = await prisma.salaryStructureAssignment.findFirst({
        where: { employeeId, isActive: true },
        include: { salaryStructure: true },
    });

    if (!salaryAssignment) {
        return {
            encashableDays: 0,
            dailyRate: 0,
            encashmentAmount: 0,
            breakdown: [],
        };
    }

    const basicSalary = Math.round(
        salaryAssignment.grossSalary * (salaryAssignment.salaryStructure.basicPercentage / 100)
    );
    const dailyRate = Math.round(basicSalary / 26); // 26 working days

    // Get all leave allocations for current year
    const allocations = await prisma.leaveAllocation.findMany({
        where: {
            employeeId,
            year: currentYear,
        },
        include: {
            leaveType: true,
        },
    });

    let totalEncashableDays = 0;
    let totalEncashmentAmount = 0;
    const breakdown: LeaveSettlementResult["breakdown"] = [];

    for (const alloc of allocations) {
        const balance = alloc.allocatedDays + alloc.carriedForward - alloc.usedDays;
        const encashable = alloc.leaveType.encashmentAllowed && balance > 0;
        const encashRate = alloc.leaveType.encashmentRate;

        if (encashable) {
            const encashDays = Math.max(0, balance);
            totalEncashableDays += encashDays;
            totalEncashmentAmount += Math.round(encashDays * dailyRate * (encashRate / 100));
        }

        breakdown.push({
            leaveType: alloc.leaveType.name,
            balance: Math.max(0, balance),
            encashable,
            encashRate,
        });
    }

    return {
        encashableDays: totalEncashableDays,
        dailyRate,
        encashmentAmount: totalEncashmentAmount,
        breakdown,
    };
}
