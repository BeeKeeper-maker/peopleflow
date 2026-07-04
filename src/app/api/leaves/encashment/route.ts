import { NextResponse } from "next/server";

import { requireAdminOrHR } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { calculateEncashment } from "@/lib/leave-engine";
import { leaveLogger } from "@/lib/logger";

/**
 * POST - Calculate leave encashment for an employee
 */
export async function POST(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const body = await req.json();
        const { employeeId, leaveTypeId, year } = body;

        // ✅ Input validation
        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json({ error: "Valid employee ID is required" }, { status: 400 });
        }
        if (!leaveTypeId || typeof leaveTypeId !== "string") {
            return NextResponse.json({ error: "Valid leave type ID is required" }, { status: 400 });
        }
        if (!year || typeof year !== "number" || year < 2020 || year > 2099) {
            return NextResponse.json({ error: "Valid year is required (2020-2099)" }, { status: 400 });
        }

        // ✅ Org-scoping: verify employee belongs to same organization
        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: { id: employeeId, organizationId: ctx.organizationId },
            select: { id: true },
        }));

        if (!employee) {
            return NextResponse.json({ error: "Employee not found in your organization" }, { status: 404 });
        }

        const result = await calculateEncashment(employeeId, leaveTypeId, year);

        if (!result) {
            return NextResponse.json(
                { error: "Unable to calculate encashment. Leave type may not allow encashment." },
                { status: 400 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        leaveLogger.error({ err: error }, "Leave encashment error:");
        return NextResponse.json(
            { error: "Failed to calculate leave encashment" },
            { status: 500 }
        );
    }
}

/**
 * GET - Leave encashment report for all employees
 * ✅ OPTIMIZED: Batch fetches instead of N×M nested loops with per-iteration DB calls
 */
export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

        if (year < 2020 || year > 2099) {
            return NextResponse.json({ error: "Valid year required" }, { status: 400 });
        }

        // Get encashable leave types in this org
        const encashableLeaveTypes = await auth.withDB((db) => db.leaveType.findMany({
            where: {
                organizationId: ctx.organizationId,
                isActive: true,
                encashmentAllowed: true,
            },
        }));

        if (encashableLeaveTypes.length === 0) {
            return NextResponse.json({ report: [], totalEncashment: 0 });
        }

        // Get active employees with salary info (batch)
        const employees = await auth.withDB((db) => db.employee.findMany({
            where: { organizationId: ctx.organizationId, employmentStatus: "active" },
            include: {
                user: { select: { name: true } },
                salaryAssignments: {
                    where: { isActive: true },
                    include: { salaryStructure: true },
                    take: 1,
                },
            },
        }));

        // Get all allocations for the year (batch)
        const employeeIds = employees.map(e => e.id);
        const leaveTypeIds = encashableLeaveTypes.map(lt => lt.id);

        const allocations = await auth.withDB((db) => db.leaveAllocation.findMany({
            where: {
                year,
                employeeId: { in: employeeIds },
                leaveTypeId: { in: leaveTypeIds },
            },
        }));

        // Build allocation lookup
        const allocMap = new Map<string, typeof allocations[0]>();
        for (const alloc of allocations) {
            allocMap.set(`${alloc.employeeId}:${alloc.leaveTypeId}`, alloc);
        }

        // Calculate encashment for each employee × leave type
        const report = [];
        let totalEncashment = 0;

        for (const emp of employees) {
            const assignment = emp.salaryAssignments[0];
            if (!assignment) continue;

            const basicSalary = assignment.grossSalary * (assignment.salaryStructure.basicPercentage / 100);
            const dailyRate = basicSalary / 26;

            for (const lt of encashableLeaveTypes) {
                const alloc = allocMap.get(`${emp.id}:${lt.id}`);
                if (!alloc) continue;

                const encashableDays = Math.max(
                    0,
                    alloc.allocatedDays + alloc.carriedForward - alloc.usedDays
                );

                if (encashableDays <= 0) continue;

                const encashmentRatePercent = lt.encashmentRate ?? 100;
                const amount = Math.round(encashableDays * dailyRate * (encashmentRatePercent / 100));
                totalEncashment += amount;

                report.push({
                    employeeId: emp.id,
                    employeeName: emp.user?.name ?? "Unknown",
                    leaveType: lt.name,
                    encashableDays,
                    dailyRate: Math.round(dailyRate),
                    encashmentRate: encashmentRatePercent,
                    amount,
                });
            }
        }

        return NextResponse.json({
            year,
            report,
            totalEncashment,
            summary: {
                totalEmployees: employees.length,
                totalRecords: report.length,
            },
        });
    } catch (error) {
        leaveLogger.error({ err: error }, "Encashment report error:");
        return NextResponse.json(
            { error: "Failed to generate encashment report" },
            { status: 500 }
        );
    }
}
