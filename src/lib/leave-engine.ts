/**
 * PeopleFlow Leave Calculation Engine
 *
 * Core module for leave balance computation, carry-forward,
 * encashment, and sandwich policy enforcement.
 *
 * ✅ Audit fixes applied:
 *  - encashmentRate from schema now used in calculateEncashment()
 *  - Sandwich policy corrected: only count weekends BETWEEN leave days
 *  - Date validation: fromDate ≤ toDate
 *  - RLS-aware: cron entry-point processCarryForward() now wraps its
 *    reads/writes in withTenant() so it works in production with RLS
 *    enforced (P0-BACKEND).
 */

import prisma from "@/lib/prisma";
import { withTenant } from "@/lib/prisma";

// ============================================
// Leave Balance Calculation
// ============================================

export interface LeaveBalance {
    leaveTypeId: string;
    leaveTypeName: string;
    leaveTypeCode: string;
    annualAllocation: number;
    carriedForward: number;
    totalEntitlement: number;
    used: number;
    pending: number;
    available: number;
}

export async function getLeaveBalance(
    employeeId: string,
    year: number,
    organizationId: string
): Promise<LeaveBalance[]> {
    // Get all leave types for the organization
    const leaveTypes = await prisma.leaveType.findMany({
        where: { organizationId, isActive: true },
    });

    const balances: LeaveBalance[] = [];

    for (const lt of leaveTypes) {
        // Get allocation for this year
        const allocation = await prisma.leaveAllocation.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId,
                    leaveTypeId: lt.id,
                    year,
                },
            },
        });

        // Get used days (approved leaves this year)
        const usedDays = await prisma.leaveApplication.aggregate({
            _sum: { totalDays: true },
            where: {
                employeeId,
                leaveTypeId: lt.id,
                status: "approved",
                fromDate: {
                    gte: new Date(year, 0, 1),
                    lte: new Date(year, 11, 31),
                },
            },
        });

        // Get pending days 
        const pendingDays = await prisma.leaveApplication.aggregate({
            _sum: { totalDays: true },
            where: {
                employeeId,
                leaveTypeId: lt.id,
                status: "pending",
                fromDate: {
                    gte: new Date(year, 0, 1),
                    lte: new Date(year, 11, 31),
                },
            },
        });

        const allocated = allocation?.allocatedDays ?? lt.annualAllocation;
        const carried = allocation?.carriedForward ?? 0;
        const used = usedDays._sum.totalDays ?? 0;
        const pending = pendingDays._sum.totalDays ?? 0;
        const totalEntitlement = allocated + carried;
        const available = Math.max(0, totalEntitlement - used - pending);

        balances.push({
            leaveTypeId: lt.id,
            leaveTypeName: lt.name,
            leaveTypeCode: lt.code,
            annualAllocation: allocated,
            carriedForward: carried,
            totalEntitlement,
            used,
            pending,
            available,
        });
    }

    return balances;
}

// ============================================
// Carry Forward Processing (Year-End)
// ============================================

export interface CarryForwardResult {
    employeeId: string;
    employeeName: string;
    leaveType: string;
    previousBalance: number;
    carriedForward: number;
    lapsed: number;
}

export async function processCarryForward(
    organizationId: string,
    fromYear: number
): Promise<CarryForwardResult[]> {
    const toYear = fromYear + 1;
    const results: CarryForwardResult[] = [];

    // RLS-aware: wrap all DB work in withTenant so the cron-driven
    // carry-forward job works correctly in production with RLS enforced.
    await withTenant(organizationId, async (db) => {
        // Get all active employees
        const employees = await db.employee.findMany({
            where: { organizationId, employmentStatus: "active" },
            include: { user: { select: { name: true } } },
        });

        // Get leave types with carry-forward
        const leaveTypes = await db.leaveType.findMany({
            where: {
                organizationId,
                isActive: true,
                carryForwardLimit: { not: null },
            },
        });

        // ✅ PERF: Single batch query instead of N×M sequential findUnique calls.
        // At 1000 employees × 5 leave types this collapses ~5000 sequential
        // queries into ONE findMany. We then look up allocations via a Map
        // keyed by `${employeeId}:${leaveTypeId}` for O(1) access.
        const employeeIds = employees.map((e) => e.id);
        const leaveTypeIds = leaveTypes.map((lt) => lt.id);

        const existingAllocations =
            employeeIds.length > 0 && leaveTypeIds.length > 0
                ? await db.leaveAllocation.findMany({
                      where: {
                          employeeId: { in: employeeIds },
                          leaveTypeId: { in: leaveTypeIds },
                          year: fromYear,
                      },
                  })
                : [];

        const allocMap = new Map<string, (typeof existingAllocations)[number]>();
        for (const a of existingAllocations) {
            allocMap.set(`${a.employeeId}:${a.leaveTypeId}`, a);
        }

        for (const employee of employees) {
            for (const lt of leaveTypes) {
                // Get current year's balance from the pre-fetched map
                const allocation = allocMap.get(`${employee.id}:${lt.id}`);

                if (!allocation) continue;

                const remainingDays = Math.max(
                    0,
                    allocation.allocatedDays + allocation.carriedForward - allocation.usedDays
                );

                const maxCarry = lt.carryForwardLimit ?? 0;
                const carriedForward = Math.min(remainingDays, maxCarry);
                const lapsed = remainingDays - carriedForward;

                // Create or update next year's allocation
                await db.leaveAllocation.upsert({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId: employee.id,
                            leaveTypeId: lt.id,
                            year: toYear,
                        },
                    },
                    create: {
                        employeeId: employee.id,
                        organizationId,
                        leaveTypeId: lt.id,
                        year: toYear,
                        allocatedDays: lt.annualAllocation,
                        carriedForward,
                        usedDays: 0,
                    },
                    update: {
                        carriedForward,
                    },
                });

                results.push({
                    employeeId: employee.id,
                    employeeName: employee.user?.name ?? "Unknown",
                    leaveType: lt.name,
                    previousBalance: remainingDays,
                    carriedForward,
                    lapsed,
                });
            }
        }
    });

    return results;
}

// ============================================
// Leave Encashment
// ============================================

export interface EncashmentResult {
    employeeId: string;
    employeeName: string;
    leaveType: string;
    encashableDays: number;
    dailyRate: number;
    encashmentRate: number; // ✅ NEW: percentage rate from schema
    encashmentAmount: number;
}

export async function calculateEncashment(
    employeeId: string,
    leaveTypeId: string,
    year: number
): Promise<EncashmentResult | null> {
    const leaveType = await prisma.leaveType.findUnique({
        where: { id: leaveTypeId },
    });

    if (!leaveType || !leaveType.encashmentAllowed) {
        return null;
    }

    const allocation = await prisma.leaveAllocation.findUnique({
        where: {
            employeeId_leaveTypeId_year: {
                employeeId,
                leaveTypeId,
                year,
            },
        },
    });

    if (!allocation) return null;

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
            user: { select: { name: true } },
            salaryAssignments: {
                where: { isActive: true },
                include: { salaryStructure: true },
                take: 1,
            },
        },
    });

    if (!employee || !employee.salaryAssignments[0]) return null;

    const assignment = employee.salaryAssignments[0];
    const basicSalary = Number(assignment.grossSalary) * (Number(assignment.salaryStructure.basicPercentage) / 100);
    const dailyRate = basicSalary / 26; // 26 working days

    const encashableDays = Math.max(
        0,
        allocation.allocatedDays + allocation.carriedForward - allocation.usedDays
    );

    // ✅ FIXED: Use encashmentRate from LeaveType schema (default 100%)
    const encashmentRatePercent = leaveType.encashmentRate ?? 100;
    const encashmentAmount = Math.round(encashableDays * dailyRate * (encashmentRatePercent / 100));

    return {
        employeeId,
        employeeName: employee.user?.name ?? "Unknown",
        leaveType: leaveType.name,
        encashableDays,
        dailyRate: Math.round(dailyRate),
        encashmentRate: encashmentRatePercent,
        encashmentAmount,
    };
}

// ============================================
// Sandwich Policy
// ============================================

/**
 * ✅ FIXED: Sandwich policy correctly defined:
 * Weekends/holidays that fall BETWEEN two leave days are counted as leave.
 * 
 * Example: Leave on Thursday + Monday → Friday & Saturday (weekend) are also counted.
 * But: Leave only on Thursday → weekend is NOT counted (no leave after weekend).
 * 
 * The function checks if weekends are "sandwiched" — i.e., there are actual
 * leave days both BEFORE and AFTER the weekend block.
 */
export function applySandwichPolicy(
    fromDate: Date,
    toDate: Date,
    weekendDays: number[] = [5, 6] // Friday and Saturday
): { totalDays: number; sandwichDays: number } {
    // ✅ Validate dates
    if (fromDate > toDate) {
        return { totalDays: 0, sandwichDays: 0 };
    }

    // Collect all dates in range, marking each as weekend or working day
    const dates: { date: Date; isWeekend: boolean }[] = [];
    const currentDate = new Date(fromDate);

    while (currentDate <= toDate) {
        dates.push({
            date: new Date(currentDate),
            isWeekend: weekendDays.includes(currentDate.getDay()),
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Count sandwich days: weekends that have working days on BOTH sides
    let sandwichDays = 0;
    for (let i = 0; i < dates.length; i++) {
        if (dates[i].isWeekend) {
            // Check if there's a working day before this weekend block
            let hasBefore = false;
            for (let j = i - 1; j >= 0; j--) {
                if (!dates[j].isWeekend) { hasBefore = true; break; }
            }

            // Check if there's a working day after this weekend block
            let hasAfter = false;
            for (let j = i + 1; j < dates.length; j++) {
                if (!dates[j].isWeekend) { hasAfter = true; break; }
            }

            // Only count as sandwich if working days exist on both sides
            if (hasBefore && hasAfter) {
                sandwichDays++;
            }
        }
    }

    const workingDays = dates.filter(d => !d.isWeekend).length;
    const totalDays = workingDays + sandwichDays;

    return { totalDays, sandwichDays };
}

/**
 * Calculate effective leave days considering sandwich policy
 */
export function calculateEffectiveLeaveDays(
    fromDate: Date,
    toDate: Date,
    useSandwichPolicy: boolean,
    weekendDays: number[] = [5, 6]
): number {
    // ✅ Validate dates
    if (fromDate > toDate) return 0;

    if (useSandwichPolicy) {
        const { totalDays } = applySandwichPolicy(fromDate, toDate, weekendDays);
        return totalDays;
    }

    // Without sandwich policy — count only working days
    let workingDays = 0;
    const currentDate = new Date(fromDate);
    while (currentDate <= toDate) {
        if (!weekendDays.includes(currentDate.getDay())) {
            workingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
}
