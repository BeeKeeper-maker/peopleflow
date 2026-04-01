/**
 * Platform API: Audit Logs
 *
 * GET /api/platform/audit-logs
 *
 * Returns paginated, filterable audit trail of all platform admin actions.
 * Supports filtering by action type, target, admin, and date range.
 * Platform admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    requirePlatformAuth,
    isPlatformAuthenticated,
} from "@/lib/platform-auth";

export async function GET(request: NextRequest) {
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

    try {
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
        const action = url.searchParams.get("action"); // e.g., "tenant.suspend"
        const targetType = url.searchParams.get("targetType"); // "organization", "subscription"
        const targetId = url.searchParams.get("targetId");
        const adminId = url.searchParams.get("adminId");
        const from = url.searchParams.get("from"); // ISO date
        const to = url.searchParams.get("to"); // ISO date

        // Build where clause
        const where: Record<string, unknown> = {};

        if (action) where.action = action;
        if (targetType) where.targetType = targetType;
        if (targetId) where.targetId = targetId;
        if (adminId) where.platformAdminId = adminId;

        if (from || to) {
            where.createdAt = {};
            if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
            if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
        }

        const [logs, total] = await prisma.$transaction([
            prisma.platformAuditLog.findMany({
                where,
                include: {
                    platformAdmin: {
                        select: { id: true, name: true, email: true },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.platformAuditLog.count({ where }),
        ]);

        return NextResponse.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        });
    } catch (error) {
        console.error("[PLATFORM_AUDIT_LOGS] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch audit logs" },
            { status: 500 }
        );
    }
}
