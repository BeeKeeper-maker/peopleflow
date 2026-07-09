/**
 * Festival Bonus Engine
 *
 * First-class festival bonus management for Bangladesh reality:
 *   ✅ Bulk generation: "Generate Eid-ul-Fitr bonus at 100% basic for all active employees"
 *   ✅ Eligibility rules: minimum service days, probation exclusion, contractual exclusion
 *   ✅ Pro-rata for new joiners: employee joined 4 months ago → 4/12 = 33% of full bonus
 *   ✅ Configurable basis: percentage of basic salary OR gross salary
 *   ✅ Multi-festival: Eid-ul-Fitr, Eid-ul-Adha, Durga Puja, Christmas, etc.
 *   ✅ Payroll integration: pending bonuses auto-included in next salary cycle
 *
 * Bangladesh Context:
 *   - BLA 2006 doesn't mandate festival bonus, but it's a universal corporate practice.
 *   - Most companies: 2 Eid bonuses per year at 50-100% of basic salary.
 *   - RMG sector: Government mandates bonus payment before each Eid.
 *   - New joiners with < 1 year service get pro-rated bonus.
 *   - Probation employees are excluded unless company policy says otherwise.
 */

import prisma from "@/lib/prisma";
import { differenceInCalendarDays } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────

export interface GenerateBonusInput {
    bonusConfigId: string;
}

export interface GenerateBonusResult {
    configId: string;
    configName: string;
    totalEligible: number;
    totalIneligible: number;
    totalAmount: number;
    payments: Array<{
        employeeId: string;
        employeeName: string;
        employeeCode: string;
        amount: number;
        basisAmount: number;
        percentageApplied: number;
        proRataFactor: number;
        isProRated: boolean;
    }>;
    ineligibleReasons: Array<{
        employeeId: string;
        employeeName: string;
        reason: string;
    }>;
}

export interface BonusSummary {
    configId: string;
    name: string;
    festivalType: string;
    year: number;
    status: string;
    totalPayments: number;
    totalAmount: number;
    pendingCount: number;
    paidCount: number;
}

// ── Core Engine ─────────────────────────────────────────────────────

/**
 * Generate festival bonus payments for all eligible employees.
 *
 * This is the main "big red button" — HR clicks "Generate Eid Bonus"
 * and this function calculates individual amounts for every eligible employee.
 *
 * Steps:
 *   1. Load bonus config (basis, percentage, eligibility rules)
 *   2. Load all active employees with their salary structures
 *   3. Apply eligibility filters (service days, probation, contractual)
 *   4. Calculate pro-rata for new joiners
 *   5. Create FestivalBonusPayment records in bulk
 *   6. Update config status to "generated"
 */
export async function generateFestivalBonus(
    input: GenerateBonusInput
): Promise<GenerateBonusResult> {
    const config = await prisma.festivalBonusConfig.findUnique({
        where: { id: input.bonusConfigId },
        include: {
            organization: { select: { id: true, name: true } },
            payments: { select: { employeeId: true } },
        },
    });

    if (!config) {
        throw new Error("Festival bonus configuration not found");
    }

    if (config.status !== "draft") {
        throw new Error(`Cannot generate: bonus is already in "${config.status}" state. Only "draft" configs can be generated.`);
    }

    // If there are existing payments (e.g., from a failed previous run), delete them
    if (config.payments.length > 0) {
        await prisma.festivalBonusPayment.deleteMany({
            where: { bonusConfigId: config.id },
        });
    }

    // Get all active employees with salary structures
    const employees = await prisma.employee.findMany({
        where: {
            organizationId: config.organizationId,
            employmentStatus: "active",
            deletedAt: null,
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            joiningDate: true,
            confirmationDate: true,
            employmentType: true,
            pfEnabled: true,
            salaryAssignments: {
                where: { isActive: true },
                include: { salaryStructure: true },
                take: 1,
            },
        },
    });

    const result: GenerateBonusResult = {
        configId: config.id,
        configName: config.name,
        totalEligible: 0,
        totalIneligible: 0,
        totalAmount: 0,
        payments: [],
        ineligibleReasons: [],
    };

    const today = new Date();
    const paymentsToCreate: Array<{
        employeeId: string;
        organizationId: string;
        bonusConfigId: string;
        amount: number;
        basisAmount: number;
        percentageApplied: number;
        proRataFactor: number;
        isProRated: boolean;
        status: string;
    }> = [];

    for (const emp of employees) {
        const name = `${emp.firstName} ${emp.lastName}`;

        // ── Eligibility Check 1: Active salary structure ──
        const assignment = emp.salaryAssignments[0];
        if (!assignment) {
            result.ineligibleReasons.push({
                employeeId: emp.id,
                employeeName: name,
                reason: "No active salary structure assigned",
            });
            result.totalIneligible++;
            continue;
        }

        // ── Eligibility Check 2: Minimum service days ──
        const serviceDays = differenceInCalendarDays(today, emp.joiningDate);
        if (serviceDays < config.minimumServiceDays) {
            result.ineligibleReasons.push({
                employeeId: emp.id,
                employeeName: name,
                reason: `Insufficient service: ${serviceDays} days (minimum: ${config.minimumServiceDays})`,
            });
            result.totalIneligible++;
            continue;
        }

        // ── Eligibility Check 3: Probation exclusion ──
        if (!config.includeProbation && emp.employmentType === "probation") {
            result.ineligibleReasons.push({
                employeeId: emp.id,
                employeeName: name,
                reason: "Probation period employee (excluded by policy)",
            });
            result.totalIneligible++;
            continue;
        }

        // Also check if not confirmed yet (no confirmation date = still in probation)
        if (!config.includeProbation && !emp.confirmationDate && emp.employmentType !== "permanent") {
            result.ineligibleReasons.push({
                employeeId: emp.id,
                employeeName: name,
                reason: "Not yet confirmed (probation period)",
            });
            result.totalIneligible++;
            continue;
        }

        // ── Eligibility Check 4: Contractual exclusion ──
        if (!config.includeContractual && emp.employmentType === "contractual") {
            result.ineligibleReasons.push({
                employeeId: emp.id,
                employeeName: name,
                reason: "Contractual employee (excluded by policy)",
            });
            result.totalIneligible++;
            continue;
        }

        // ── Calculate Bonus Amount ──
        const structure = assignment.salaryStructure;
        const grossSalary = assignment.grossSalary;
        const basicSalary = Math.round(grossSalary * (structure.basicPercentage / 100));

        // Determine basis amount
        const basisAmount = config.calculationBasis === "gross" ? grossSalary : basicSalary;

        // Pro-rata calculation for new joiners
        let proRataFactor = 1.0;
        let isProRated = false;

        if (config.proRataForNewJoinee && serviceDays < 365) {
            // Pro-rata: (service days / 365) capped at 1.0
            proRataFactor = Math.min(1.0, serviceDays / 365);
            proRataFactor = Math.round(proRataFactor * 100) / 100; // Round to 2 decimal places
            isProRated = true;
        }

        const effectivePercentage = config.percentageOfBasis * proRataFactor;
        const amount = Math.round(basisAmount * (effectivePercentage / 100));

        paymentsToCreate.push({
            employeeId: emp.id,
            organizationId: config.organizationId,
            bonusConfigId: config.id,
            amount,
            basisAmount,
            percentageApplied: effectivePercentage,
            proRataFactor,
            isProRated,
            status: "pending",
        });

        result.payments.push({
            employeeId: emp.id,
            employeeName: name,
            employeeCode: emp.employeeCode,
            amount,
            basisAmount,
            percentageApplied: effectivePercentage,
            proRataFactor,
            isProRated,
        });

        result.totalAmount += amount;
        result.totalEligible++;
    }

    // Bulk insert all payment records
    if (paymentsToCreate.length > 0) {
        await prisma.festivalBonusPayment.createMany({
            data: paymentsToCreate,
        });
    }

    // Update config status to "generated"
    await prisma.festivalBonusConfig.update({
        where: { id: config.id },
        data: { status: "generated" },
    });

    return result;
}

// ── Payroll Integration ─────────────────────────────────────────────

/**
 * Get pending festival bonus amount for an employee for a specific payroll month.
 *
 * Called by the payroll engine during salary calculation.
 * Returns the sum of all pending bonus payments and marks them as "included_in_payroll".
 */
export async function getFestivalBonusForPayroll(
    employeeId: string,
    month: number,
    year: number
): Promise<number> {
    const pendingBonuses = await prisma.festivalBonusPayment.findMany({
        where: {
            employeeId,
            status: "pending",
        },
    });

    if (pendingBonuses.length === 0) return 0;

    let totalBonus = 0;

    for (const bonus of pendingBonuses) {
        totalBonus += bonus.amount;

        // Mark as included in this payroll cycle
        await prisma.festivalBonusPayment.update({
            where: { id: bonus.id },
            data: {
                status: "included_in_payroll",
                payrollMonth: month,
                payrollYear: year,
            },
        });
    }

    return Math.round(totalBonus);
}

// ── Summary & Reporting ─────────────────────────────────────────────

/**
 * Get summary of a festival bonus config with payment statistics.
 */
export async function getFestivalBonusSummary(
    configId: string
): Promise<BonusSummary | null> {
    const config = await prisma.festivalBonusConfig.findUnique({
        where: { id: configId },
        include: {
            _count: {
                select: { payments: true },
            },
            payments: {
                select: { amount: true, status: true },
            },
        },
    });

    if (!config) return null;

    const totalAmount = config.payments.reduce((sum, p) => sum + p.amount, 0);
    const pendingCount = config.payments.filter((p) => p.status === "pending").length;
    const paidCount = config.payments.filter(
        (p) => p.status === "included_in_payroll" || p.status === "paid"
    ).length;

    return {
        configId: config.id,
        name: config.name,
        festivalType: config.festivalType,
        year: config.year,
        status: config.status,
        totalPayments: config._count.payments,
        totalAmount: Math.round(totalAmount),
        pendingCount,
        paidCount,
    };
}

/**
 * List all festival bonus configs for an organization, optionally filtered by year.
 */
export async function listFestivalBonusConfigs(
    organizationId: string,
    year?: number
): Promise<BonusSummary[]> {
    const configs = await prisma.festivalBonusConfig.findMany({
        where: {
            organizationId,
            ...(year ? { year } : {}),
        },
        include: {
            _count: { select: { payments: true } },
            payments: { select: { amount: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return configs.map((config) => {
        const totalAmount = config.payments.reduce((sum, p) => sum + p.amount, 0);
        const pendingCount = config.payments.filter((p) => p.status === "pending").length;
        const paidCount = config.payments.filter(
            (p) => p.status === "included_in_payroll" || p.status === "paid"
        ).length;

        return {
            configId: config.id,
            name: config.name,
            festivalType: config.festivalType,
            year: config.year,
            status: config.status,
            totalPayments: config._count.payments,
            totalAmount: Math.round(totalAmount),
            pendingCount,
            paidCount,
        };
    });
}
