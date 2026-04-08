/**
 * CRON: Leave Allocation & Carry-Forward
 * 
 * Endpoint: GET /api/cron/leave-allocation
 * Schedule: January 1 annually (or triggered manually)
 * 
 * Two modes:
 *  1. ?action=provision&year=2027 — Create fresh allocations for all active employees
 *  2. ?action=carryforward&fromYear=2026 — Process carry-forward from previous year
 * 
 * Default (no params): provisions for current year + carry-forward from previous year
 */

import { verifyCronAuth, cronResponse } from "@/lib/cron-auth";
import { processCarryForward } from "@/lib/leave-engine";
import { emit } from "@/lib/event-bus";
import { prisma } from "@/lib/prisma";
import { cronLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Large orgs with many leave types may take time

export async function GET(req: Request) {
    // ── Auth ──
    const authError = verifyCronAuth(req);
    if (authError) return authError;

    const startTime = Date.now();

    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action") || "auto"; // auto, provision, carryforward
        const currentYear = new Date().getFullYear();
        const targetYear = parseInt(searchParams.get("year") || String(currentYear));
        const fromYear = parseInt(searchParams.get("fromYear") || String(currentYear - 1));

        // Get all active organizations
        const organizations = await prisma.organization.findMany({
            where: { status: "active" },
            select: { id: true, name: true },
        });

        const allResults: Array<{
            orgName: string;
            action: string;
            allocationsCreated: number;
            carryForwardProcessed: number;
            errors: string[];
        }> = [];

        for (const org of organizations) {
            const orgResult = {
                orgName: org.name,
                action,
                allocationsCreated: 0,
                carryForwardProcessed: 0,
                errors: [] as string[],
            };

            try {
                // ── Step 1: Provision fresh allocations for target year ──
                if (action === "provision" || action === "auto") {
                    const created = await provisionAllocations(org.id, targetYear);
                    orgResult.allocationsCreated = created;
                }

                // ── Step 2: Process carry-forward from previous year ──
                if (action === "carryforward" || action === "auto") {
                    const cfResults = await processCarryForward(org.id, fromYear);
                    orgResult.carryForwardProcessed = cfResults.length;
                }

                // Emit completion event
                await emit("cron.leave_allocation.completed", {
                    organizationId: org.id,
                    year: targetYear,
                    employeesProcessed: orgResult.allocationsCreated + orgResult.carryForwardProcessed,
                    allocationsCreated: orgResult.allocationsCreated,
                });
            } catch (orgError) {
                const msg = orgError instanceof Error ? orgError.message : String(orgError);
                orgResult.errors.push(msg);
            }

            allResults.push(orgResult);
        }

        const totalAllocations = allResults.reduce((s, r) => s + r.allocationsCreated, 0);
        const totalCarryForward = allResults.reduce((s, r) => s + r.carryForwardProcessed, 0);
        const totalErrors = allResults.reduce((s, r) => s + r.errors.length, 0);

        return cronResponse(
            {
                job: "leave-allocation",
                action,
                targetYear,
                fromYear: action === "carryforward" || action === "auto" ? fromYear : undefined,
                organizations: organizations.length,
                totalAllocationsCreated: totalAllocations,
                totalCarryForwardProcessed: totalCarryForward,
                errorCount: totalErrors,
                durationMs: Date.now() - startTime,
                details: allResults,
            },
            totalErrors > 0 ? "partial" : "success"
        );
    } catch (error) {
        cronLogger.error({ err: error }, "[CRON] leave-allocation FATAL:");
        return cronResponse(
            {
                job: "leave-allocation",
                error: error instanceof Error ? error.message : "Unknown error",
                durationMs: Date.now() - startTime,
            },
            "error"
        );
    }
}

/**
 * Create fresh leave allocations for all active employees × all active leave types
 * for a given year. Skips employees who already have an allocation for that type+year.
 */
async function provisionAllocations(
    organizationId: string,
    year: number
): Promise<number> {
    // Get all active employees
    const employees = await prisma.employee.findMany({
        where: {
            organizationId,
            employmentStatus: "active",
            deletedAt: null,
        },
        select: {
            id: true,
            gender: true,
            joiningDate: true,
        },
    });

    // Get all active leave types
    const leaveTypes = await prisma.leaveType.findMany({
        where: {
            organizationId,
            isActive: true,
        },
        select: {
            id: true,
            name: true,
            annualAllocation: true,
            applicableGender: true,
            minServiceDays: true,
        },
    });

    let created = 0;
    const today = new Date();

    for (const employee of employees) {
        for (const lt of leaveTypes) {
            // ── Gender eligibility check ──
            if (
                lt.applicableGender &&
                lt.applicableGender !== "all" &&
                employee.gender?.toLowerCase() !== lt.applicableGender.toLowerCase()
            ) {
                continue;
            }

            // ── Minimum service days check ──
            if (lt.minServiceDays && employee.joiningDate) {
                const serviceDays = Math.floor(
                    (today.getTime() - new Date(employee.joiningDate).getTime()) / 86400000
                );
                if (serviceDays < lt.minServiceDays) continue;
            }

            // ── Upsert allocation (create if not exists) ──
            try {
                await prisma.leaveAllocation.upsert({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId: employee.id,
                            leaveTypeId: lt.id,
                            year,
                        },
                    },
                    create: {
                        employeeId: employee.id,
                        leaveTypeId: lt.id,
                        year,
                        allocatedDays: lt.annualAllocation,
                        usedDays: 0,
                        carriedForward: 0,
                    },
                    update: {}, // Don't overwrite existing allocations
                });
                created++;
            } catch (error) {
                // Unique constraint or other DB error — skip
                cronLogger.error({ err: error }, `[ALLOC] Skip ${employee.id}×${lt.name}:`);
            }
        }
    }

    return created;
}
