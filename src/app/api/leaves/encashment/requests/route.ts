import { NextResponse } from "next/server";

import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { leaveLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";

/**
 * GET /api/leaves/encashment/requests — List encashment requests
 *
 * Query params:
 *   - status: filter by status (pending, approved, rejected, paid)
 *   - employeeId: filter by employee (HR only; employees auto-filtered to self)
 *   - year: filter by year (based on requestedAt)
 *
 * Authorization:
 *   - admin / hr_admin / super_admin: see all org requests
 *   - manager: see requests for direct reportees only
 *   - employee: see own requests only
 */
export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const employeeIdFilter = searchParams.get("employeeId");
        const year = searchParams.get("year");

        const where: Record<string, unknown> = {
            organizationId: ctx.organizationId,
        };

        if (status) where.status = status;
        if (employeeIdFilter) where.employeeId = employeeIdFilter;
        if (year) {
            const yearNum = parseInt(year, 10);
            if (!Number.isNaN(yearNum)) {
                const start = new Date(yearNum, 0, 1);
                const end = new Date(yearNum + 1, 0, 1);
                where.requestedAt = { gte: start, lt: end };
            }
        }

        // Role-based scoping
        const isHRLevel = ["super_admin", "admin", "hr_admin"].includes(ctx.role);
        if (!isHRLevel) {
            if (ctx.role === "manager") {
                // Manager sees own + direct reportees
                const reportees = await auth.withDB((db) => db.employee.findMany({
                    where: { reportingManagerId: ctx.employeeId, organizationId: ctx.organizationId },
                    select: { id: true },
                }));
                const reporteeIds = reportees.map((r) => r.id);
                where.OR = [
                    { employeeId: ctx.employeeId },
                    ...(ctx.employeeId ? [{ employeeId: ctx.employeeId }] : []),
                    ...(reporteeIds.length > 0 ? [{ employeeId: { in: reporteeIds } }] : []),
                ];
            } else {
                // Employee sees own only
                where.employeeId = ctx.employeeId;
            }
        }

        const requests = await auth.withDB((db) => db.leaveEncashmentRequest.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                    },
                },
                leaveType: {
                    select: { id: true, name: true, nameBn: true },
                },
            },
            orderBy: { requestedAt: "desc" },
        }));

        return NextResponse.json({ data: requests, total: requests.length });
    } catch (error) {
        leaveLogger.error({ err: error }, "GET_ENCASHMENT_REQUESTS_ERROR");
        return NextResponse.json(
            { error: "Failed to fetch encashment requests" },
            { status: 500 },
        );
    }
}

/**
 * POST /api/leaves/encashment/requests — Create a new encashment request
 *
 * Body:
 *   {
 *     "employeeId": "emp_...",      // optional for employee role (defaults to self)
 *     "leaveTypeId": "lt_...",
 *     "requestedDays": 5,
 *     "year": 2026,
 *     "reason": "Year-end encashment"
 *   }
 *
 * Calculates encashableDays, dailyBasicRate, encashmentAmount server-side.
 * The client cannot set these — they are computed from the employee's
 * salary assignment and the leave type's encashmentRate.
 *
 * Authorization:
 *   - Employee: can request for self only
 *   - HR/Admin: can request on behalf of any employee
 */
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const { leaveTypeId, requestedDays, year, reason } = body;
        let employeeId = typeof body.employeeId === "string" ? body.employeeId : ctx.employeeId;

        // Validation
        if (!leaveTypeId || typeof leaveTypeId !== "string") {
            return NextResponse.json({ error: "leaveTypeId is required" }, { status: 400 });
        }
        if (!requestedDays || typeof requestedDays !== "number" || requestedDays <= 0) {
            return NextResponse.json(
                { error: "requestedDays must be a positive number" },
                { status: 400 },
            );
        }
        if (!year || typeof year !== "number" || year < 2020 || year > 2099) {
            return NextResponse.json(
                { error: "Valid year is required (2020-2099)" },
                { status: 400 },
            );
        }

        // Employee role can only request for self
        if (ctx.role === "employee" && employeeId !== ctx.employeeId) {
            return NextResponse.json(
                { error: "You can only request encashment for yourself" },
                { status: 403 },
            );
        }
        if (!employeeId) {
            return NextResponse.json(
                { error: "employeeId is required (no linked employee profile)" },
                { status: 400 },
            );
        }

        // Verify employee belongs to org
        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: { id: employeeId, organizationId: ctx.organizationId },
            include: {
                salaryAssignments: {
                    where: { isActive: true },
                    include: { salaryStructure: true },
                    take: 1,
                },
            },
        }));

        if (!employee) {
            return NextResponse.json(
                { error: "Employee not found in your organization" },
                { status: 404 },
            );
        }

        // Verify leave type allows encashment
        const leaveType = await auth.withDB((db) => db.leaveType.findFirst({
            where: {
                id: leaveTypeId,
                organizationId: ctx.organizationId,
                isActive: true,
                encashmentAllowed: true,
            },
        }));

        if (!leaveType) {
            return NextResponse.json(
                { error: "Leave type not found or does not allow encashment" },
                { status: 400 },
            );
        }

        // Get current year's allocation
        const allocation = await auth.withDB((db) => db.leaveAllocation.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId,
                    leaveTypeId,
                    year,
                },
            },
        }));

        if (!allocation) {
            return NextResponse.json(
                { error: `No leave allocation found for ${year}` },
                { status: 400 },
            );
        }

        // Calculate encashable days (remaining balance)
        const encashableDays = Math.max(
            0,
            allocation.allocatedDays + allocation.carriedForward - allocation.usedDays,
        );

        if (encashableDays <= 0) {
            return NextResponse.json(
                { error: "No encashable leave balance available" },
                { status: 400 },
            );
        }

        // Cap at requested days
        const actualEncashableDays = Math.min(requestedDays, encashableDays);

        // Calculate daily basic rate from salary assignment
        const assignment = employee.salaryAssignments[0];
        if (!assignment) {
            return NextResponse.json(
                { error: "No active salary assignment found. Cannot calculate encashment amount." },
                { status: 400 },
            );
        }

        // dailyBasicRate = grossSalary / 30 (industry standard for encashment)
        const dailyBasicRate = Math.round(Number(assignment.grossSalary) / 30);
        const encashmentRate = leaveType.encashmentRate ?? 100;
        const encashmentAmount = Math.round(
            actualEncashableDays * dailyBasicRate * (encashmentRate / 100),
        );

        // Create the request
        const request = await auth.withDB((db) => db.leaveEncashmentRequest.create({
            data: {
                status: "pending",
                requestedDays,
                encashableDays: actualEncashableDays,
                dailyBasicRate,
                encashmentRate,
                encashmentAmount,
                reason: typeof reason === "string" ? reason.slice(0, 500) : null,
                employeeId,
                leaveTypeId,
                allocationId: allocation.id,
                organizationId: ctx.organizationId,
            },
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, employeeCode: true },
                },
                leaveType: { select: { id: true, name: true, nameBn: true } },
            },
        }));

        await createAuditLog({
            organizationId: ctx.organizationId,
            action: "create",
            entityType: "LeaveEncashmentRequest",
            entityId: request.id,
            newValues: {
                employeeId,
                leaveTypeId,
                requestedDays,
                encashableDays: actualEncashableDays,
                encashmentAmount,
            },
            userId: ctx.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            leaveLogger.error({ err }, "Failed to write audit log for encashment request");
        });

        return NextResponse.json({
            success: true,
            request,
            message: `Encashment request submitted for ${actualEncashableDays} day(s). Amount: BDT ${encashmentAmount}. Pending approval.`,
        });
    } catch (error) {
        leaveLogger.error({ err: error }, "CREATE_ENCASHMENT_REQUEST_ERROR");
        return NextResponse.json(
            { error: "Failed to create encashment request" },
            { status: 500 },
        );
    }
}
