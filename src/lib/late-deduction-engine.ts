/**
 * Late Deduction Engine — Tiered Severity System
 *
 * Bangladesh Corporate Standard: Progressive late deduction tiers.
 *
 * Key differences from the old system (which was just "3 lates = 1 day cut"):
 *   ✅ Configurable tiers per organization (different policies for office vs factory)
 *   ✅ Progressive severity: Grace → Warning → Half-day cut → Full-day cut
 *   ✅ Monthly late tracking with automatic reset
 *   ✅ Warning generation at each tier (verbal → written → final)
 *   ✅ Deduction types: none, half_day, full_day, fixed_amount, percentage_of_daily
 *   ✅ Audit trail: exactly which tier applied and how much was deducted
 *
 * Example Policy (Common BD Corporate Standard):
 *   Tier 1: Lates 1-3   → Grace (No deduction, no warning)
 *   Tier 2: Lates 4-6   → Half-day salary deduction per late + verbal warning
 *   Tier 3: Lates 7-9   → Full-day salary deduction per late + written warning
 *   Tier 4: Lates 10+   → Full-day deduction per late + final warning letter
 *
 * Example Policy (RMG/Factory Standard):
 *   Tier 1: Lates 1-2   → Grace
 *   Tier 2: Lates 3-5   → Half-day cut per late
 *   Tier 3: Lates 6+    → Full-day cut per late + written warning
 */

import prisma from "@/lib/prisma";

// ── Types ────────────────────────────────────────────────────────────

export interface LateDeductionResult {
    totalLateCount: number;
    deductionAmount: number;
    warnings: LateWarning[];
    tierBreakdown: TierDeduction[];
}

export interface LateWarning {
    tierName: string;
    warningLevel: string; // verbal, written, final
    message: string;
}

export interface TierDeduction {
    tierName: string;
    tierOrder: number;
    lateCountInTier: number;
    deductionPerLate: number;
    totalDeduction: number;
    deductionType: string;
}

// ── Core Engine ─────────────────────────────────────────────────────

/**
 * Calculate late deduction for an employee for a specific month.
 *
 * This replaces the old flat "Math.floor(lateCount / 3) * perDaySalary" formula
 * with a configurable tiered system.
 *
 * Pipeline:
 *   1. Get the organization's active late deduction policy
 *   2. Count late attendance records for the month
 *   3. Apply each tier's rules based on the cumulative late count
 *   4. Calculate total deduction + generate warnings
 *
 * @param organizationId - Organization ID
 * @param employeeId - Employee ID
 * @param month - Month (1-12)
 * @param year - Year
 * @param dailySalary - Employee's per-day salary (gross / working days)
 */
export async function calculateLateDeduction(
    organizationId: string,
    employeeId: string,
    month: number,
    year: number,
    dailySalary: number
): Promise<LateDeductionResult> {
    const result: LateDeductionResult = {
        totalLateCount: 0,
        deductionAmount: 0,
        warnings: [],
        tierBreakdown: [],
    };

    // 1. Get active late deduction policy for this organization
    const policy = await prisma.lateDeductionPolicy.findFirst({
        where: {
            organizationId,
            isActive: true,
        },
        include: {
            tiers: {
                orderBy: { tierOrder: "asc" },
            },
        },
    });

    // If no policy configured, fall back to legacy "3 lates = 1 day" behavior
    if (!policy || policy.tiers.length === 0) {
        return calculateLegacyLateDeduction(employeeId, month, year, dailySalary);
    }

    // 2. Count late attendance records for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    const lateRecords = await prisma.attendance.findMany({
        where: {
            employeeId,
            date: { gte: startDate, lte: endDate },
            lateMinutes: { gt: policy.lateThresholdMinutes },
        },
        select: {
            id: true,
            date: true,
            lateMinutes: true,
        },
        orderBy: { date: "asc" },
    });

    result.totalLateCount = lateRecords.length;

    if (result.totalLateCount === 0) return result;

    // 3. Apply tiered deduction rules
    // Each late gets counted sequentially. The tier that its position falls into determines the deduction.
    //
    // Example with 8 lates and tiers [1-3: grace, 4-6: half-day, 7-9: full-day]:
    //   Lates 1-3: Tier 1 (grace) → 0 BDT each
    //   Lates 4-6: Tier 2 (half-day) → 3 × (dailySalary/2)
    //   Lates 7-8: Tier 3 (full-day) → 2 × dailySalary

    let processedCount = 0;

    for (const tier of policy.tiers) {
        // How many lates fall into this tier?
        const tierStart = tier.fromCount;
        const tierEnd = Math.min(tier.toCount, result.totalLateCount);

        if (processedCount >= result.totalLateCount) break;
        if (processedCount >= tierEnd) continue;

        // Count lates that fall into this tier's range
        const latesInRange = Math.max(0,
            Math.min(tierEnd, result.totalLateCount) - Math.max(tierStart - 1, processedCount)
        );

        if (latesInRange <= 0) {
            processedCount = tierEnd;
            continue;
        }

        // Calculate deduction per late based on tier type
        // Phase 3 (Float → Decimal): tier.deductionValue is now Prisma.Decimal;
        // the per-tier helper works in plain `number`, so coerce at the call site.
        const deductionPerLate = calculateTierDeduction(
            tier.deductionType,
            Number(tier.deductionValue),
            dailySalary
        );

        const tierTotalDeduction = Math.round(latesInRange * deductionPerLate);

        result.tierBreakdown.push({
            tierName: tier.name,
            tierOrder: tier.tierOrder,
            lateCountInTier: latesInRange,
            deductionPerLate: Math.round(deductionPerLate),
            totalDeduction: tierTotalDeduction,
            deductionType: tier.deductionType,
        });

        result.deductionAmount += tierTotalDeduction;

        // Generate warning if tier requires it
        if (tier.issueWarning && latesInRange > 0) {
            result.warnings.push({
                tierName: tier.name,
                warningLevel: tier.warningLevel,
                message: buildWarningMessage(tier.name, tier.warningLevel, latesInRange, result.totalLateCount),
            });
        }

        processedCount = tierEnd;
    }

    result.deductionAmount = Math.round(result.deductionAmount);

    return result;
}

/**
 * Calculate the deduction amount for a single late occurrence based on tier type.
 */
function calculateTierDeduction(
    deductionType: string,
    deductionValue: number,
    dailySalary: number
): number {
    switch (deductionType) {
        case "none":
            return 0;

        case "half_day":
            return dailySalary / 2;

        case "full_day":
            return dailySalary;

        case "fixed_amount":
            return deductionValue; // Direct BDT amount (e.g., 500 per late)

        case "percentage_of_daily":
            return dailySalary * (deductionValue / 100); // e.g., 50% of daily = half day

        default:
            return 0;
    }
}

/**
 * Build a human-readable warning message.
 */
function buildWarningMessage(
    tierName: string,
    warningLevel: string,
    latesInTier: number,
    totalLates: number
): string {
    const levelLabels: Record<string, string> = {
        verbal: "Verbal Warning",
        written: "Written Warning",
        final: "Final Warning — further lates may result in disciplinary action",
    };

    const levelLabel = levelLabels[warningLevel] || "Warning";
    return `${levelLabel}: You have been late ${totalLates} time(s) this month. ${latesInTier} occurrence(s) fall under "${tierName}" tier.`;
}

// ── Legacy Fallback ─────────────────────────────────────────────────

/**
 * Legacy late deduction calculation: 3 lates = 1 day absent.
 * Used when no LateDeductionPolicy is configured for the organization.
 * This preserves backward compatibility with existing payroll data.
 */
async function calculateLegacyLateDeduction(
    employeeId: string,
    month: number,
    year: number,
    dailySalary: number
): Promise<LateDeductionResult> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const lateCount = await prisma.attendance.count({
        where: {
            employeeId,
            date: { gte: startDate, lte: endDate },
            lateMinutes: { gt: 0 },
        },
    });

    const deductionDays = Math.floor(lateCount / 3);
    const deductionAmount = Math.round(deductionDays * dailySalary);

    return {
        totalLateCount: lateCount,
        deductionAmount,
        warnings: [],
        tierBreakdown: deductionDays > 0
            ? [{
                tierName: "Legacy (3 lates = 1 day)",
                tierOrder: 1,
                lateCountInTier: lateCount,
                deductionPerLate: Math.round(dailySalary / 3),
                totalDeduction: deductionAmount,
                deductionType: "legacy",
            }]
            : [],
    };
}

// ── Utility: Get Late Statistics for Dashboard ──────────────────────

/**
 * Get late statistics for an employee — useful for dashboards and reports.
 */
export async function getEmployeeLateStats(
    employeeId: string,
    month: number,
    year: number
): Promise<{
    totalLates: number;
    totalLateMinutes: number;
    averageLateMinutes: number;
    worstLateMinutes: number;
}> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const records = await prisma.attendance.findMany({
        where: {
            employeeId,
            date: { gte: startDate, lte: endDate },
            lateMinutes: { gt: 0 },
        },
        select: { lateMinutes: true },
    });

    const totalLates = records.length;
    const totalLateMinutes = records.reduce((sum, r) => sum + r.lateMinutes, 0);
    const averageLateMinutes = totalLates > 0 ? Math.round(totalLateMinutes / totalLates) : 0;
    const worstLateMinutes = totalLates > 0 ? Math.max(...records.map((r) => r.lateMinutes)) : 0;

    return { totalLates, totalLateMinutes, averageLateMinutes, worstLateMinutes };
}
