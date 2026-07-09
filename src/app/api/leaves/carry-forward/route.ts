import { NextResponse } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { leaveLogger } from "@/lib/logger";

/**
 * Year-End Leave Carry Forward API
 * 
 * Processes carry-forward of unused leave days from one year to the next.
 * Respects each leave type's carryForwardLimit configuration.
 * 
 * Admin/HR only endpoint.
 */
export async function POST(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const json = await req.json();
        const { fromYear, toYear } = json;

        // Validate input
        if (!fromYear || !toYear) {
            return new NextResponse("fromYear and toYear are required", { status: 400 });
        }

        if (toYear !== fromYear + 1) {
            return new NextResponse("toYear must be exactly fromYear + 1", { status: 400 });
        }

        // Get all allocations for the source year in this organization
        const allocations = await auth.withDB((db) => db.leaveAllocation.findMany({
            where: {
                year: fromYear,
                employee: {
                    organizationId: auth.organizationId,
                    employmentStatus: "active", // Only active employees
                },
            },
            include: {
                leaveType: {
                    select: {
                        id: true,
                        name: true,
                        carryForwardLimit: true,
                        annualAllocation: true,
                    },
                },
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        }));

        if (allocations.length === 0) {
            return NextResponse.json({
                message: `No allocations found for year ${fromYear}`,
                processed: 0,
                skipped: 0,
            });
        }

        let processed = 0;
        let skipped = 0;
        const results: Array<{
            employee: string;
            leaveType: string;
            unused: number;
            carriedForward: number;
            capped: boolean;
        }> = [];

        for (const allocation of allocations) {
            const unusedDays = Math.max(
                0,
                allocation.allocatedDays + allocation.carriedForward - allocation.usedDays
            );

            // If no unused days, skip
            if (unusedDays <= 0) {
                skipped++;
                continue;
            }

            // Apply carry forward limit from the leave type
            const limit = allocation.leaveType.carryForwardLimit;
            const carryForwardDays = limit !== null && limit !== undefined
                ? Math.min(unusedDays, limit)
                : unusedDays; // No limit set = carry all

            // Skip if nothing to carry forward (limit = 0)
            if (carryForwardDays <= 0) {
                skipped++;
                continue;
            }

            // Upsert allocation for the target year
            await auth.withDB((db) => db.leaveAllocation.upsert({
                where: {
                    employeeId_leaveTypeId_year: {
                        employeeId: allocation.employee.id,
                        leaveTypeId: allocation.leaveType.id,
                        year: toYear,
                    },
                },
                create: {
                    employeeId: allocation.employee.id,
                    organizationId: auth.organizationId,
                    leaveTypeId: allocation.leaveType.id,
                    year: toYear,
                    allocatedDays: allocation.leaveType.annualAllocation,
                    usedDays: 0,
                    carriedForward: carryForwardDays,
                },
                update: {
                    carriedForward: carryForwardDays,
                },
            }));

            results.push({
                employee: `${allocation.employee.firstName} ${allocation.employee.lastName}`,
                leaveType: allocation.leaveType.name,
                unused: unusedDays,
                carriedForward: carryForwardDays,
                capped: limit !== null && limit !== undefined && unusedDays > limit,
            });

            processed++;
        }

        return NextResponse.json({
            message: `Carry forward processed for ${fromYear} → ${toYear}`,
            processed,
            skipped,
            details: results,
        });
    } catch (error) {
        leaveLogger.error({ err: error }, "CARRY_FORWARD_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
