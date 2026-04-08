/**
 * External API v1: Leaves
 *
 * GET /api/v1/leaves — List leave applications (paginated, filterable)
 *
 * Authenticated via API key. Scoped to the key's organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey, hasPermission } from "@/lib/api-key-auth";
import { apiLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
    const auth = await authenticateApiKey(request);
    if (!auth.valid) return auth.response;

    if (!hasPermission(auth, "leaves:read")) {
        return NextResponse.json(
            { error: "Insufficient permissions", required: "leaves:read" },
            { status: 403 }
        );
    }

    try {
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
        const status = url.searchParams.get("status"); // pending, approved, rejected
        const employeeId = url.searchParams.get("employeeId");
        const from = url.searchParams.get("from"); // ISO date
        const to = url.searchParams.get("to"); // ISO date

        const where: Record<string, unknown> = {
            employee: { organizationId: auth.organizationId },
        };

        if (status) where.status = status;
        if (employeeId) where.employeeId = employeeId;

        if (from || to) {
            where.fromDate = {};
            if (from) (where.fromDate as Record<string, unknown>).gte = new Date(from);
            if (to) (where.fromDate as Record<string, unknown>).lte = new Date(to);
        }

        const [applications, total] = await prisma.$transaction([
            prisma.leaveApplication.findMany({
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
                        select: { id: true, name: true },
                    },
                },
                orderBy: { appliedAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.leaveApplication.count({ where }),
        ]);

        return NextResponse.json({
            data: applications.map((app) => ({
                id: app.id,
                employee: app.employee,
                leaveType: app.leaveType,
                status: app.status,
                fromDate: app.fromDate,
                toDate: app.toDate,
                totalDays: app.totalDays,
                halfDay: app.halfDay,
                reason: app.reason,
                appliedAt: app.appliedAt,
                approvedAt: app.approvedAt,
                rejectionReason: app.rejectionReason,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[API_V1_LEAVES] Error:");
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
