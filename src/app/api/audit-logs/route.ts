import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";

// ✅ CSV injection protection
function escapeCsvField(value: string): string {
    const str = String(value ?? "");
    // Escape formula injection characters
    if (/^[=+\-@\t\r]/.test(str)) {
        return `"'${str.replace(/"/g, '""')}"`;
    }
    // Quote values containing commas, quotes, or newlines
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * GET - Fetch audit logs with filters
 */
export async function GET(req: Request) {
    try {
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        // Only admin/hr can view audit logs
        if (!["admin", "super_admin", "hr_admin"].includes(ctx.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1); // ✅ Validate page ≥ 1
        const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20") || 20), 100);
        const search = searchParams.get("search") || "";
        const action = searchParams.get("action") || "";
        const entityType = searchParams.get("entityType") || "";
        const userId = searchParams.get("userId") || "";
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const format = searchParams.get("format"); // "csv" for export

        // Build filters
        const where: Record<string, unknown> = {
            organizationId: ctx.organizationId,
        };

        if (search) {
            where.OR = [
                { action: { contains: search, mode: "insensitive" } },
                { entityType: { contains: search, mode: "insensitive" } },
                { entityId: { contains: search, mode: "insensitive" } },
            ];
        }

        if (action) where.action = action;
        if (entityType) where.entityType = entityType;
        if (userId) where.userId = userId;

        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
            if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo + "T23:59:59Z");
        }

        // CSV Export
        if (format === "csv") {
            const allLogs = await prisma.auditLog.findMany({
                where: where as any,
                orderBy: { createdAt: "desc" },
                take: 5000,
            });

            // Look up user names for the logs
            const logUserIds = [...new Set(allLogs.filter(l => l.userId).map(l => l.userId!))];
            const users = logUserIds.length > 0
                ? await prisma.user.findMany({
                    where: { id: { in: logUserIds } },
                    select: { id: true, name: true, email: true },
                })
                : [];
            const userMap = new Map(users.map(u => [u.id, u]));

            const csvHeaders = "Date,Time,Action,Entity Type,Entity ID,Performed By,IP Address";
            const csvRows = allLogs.map(log => {
                const date = new Date(log.createdAt);
                const user = log.userId ? userMap.get(log.userId) : null;
                return [
                    escapeCsvField(date.toLocaleDateString("en-GB")),
                    escapeCsvField(date.toLocaleTimeString("en-GB")),
                    escapeCsvField(log.action),
                    escapeCsvField(log.entityType),
                    escapeCsvField(log.entityId || ""),
                    escapeCsvField(user?.name || user?.email || ""),
                    escapeCsvField(log.ipAddress || ""),
                ].join(",");
            });

            const csv = [csvHeaders, ...csvRows].join("\n");

            return new NextResponse(csv, {
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="audit_log_export.csv"`,
                },
            });
        }

        // Paginated JSON response
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: where as any,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.auditLog.count({ where: where as any }),
        ]);

        // Look up user names
        const logUserIds = [...new Set(logs.filter(l => l.userId).map(l => l.userId!))];
        const users = logUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: logUserIds } },
                select: { id: true, name: true, email: true },
            })
            : [];
        const userMap = new Map(users.map(u => [u.id, u]));

        // Get filter options (distinct values)
        const [actions, entityTypes] = await Promise.all([
            prisma.auditLog.findMany({
                where: { organizationId: ctx.organizationId },
                select: { action: true },
                distinct: ["action"],
            }),
            prisma.auditLog.findMany({
                where: { organizationId: ctx.organizationId },
                select: { entityType: true },
                distinct: ["entityType"],
            }),
        ]);

        return NextResponse.json({
            logs: logs.map(log => {
                const user = log.userId ? userMap.get(log.userId) : null;
                return {
                    id: log.id,
                    action: log.action,
                    entityType: log.entityType,
                    entityId: log.entityId,
                    oldValues: log.oldValues,
                    newValues: log.newValues,
                    ipAddress: log.ipAddress,
                    userAgent: log.userAgent,
                    performedBy: user ? { name: user.name, email: user.email } : null,
                    createdAt: log.createdAt,
                };
            }),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            filters: {
                actions: actions.map(a => a.action),
                entityTypes: entityTypes.map(e => e.entityType),
            },
        });
    } catch (error) {
        console.error("Audit log error:", error);
        return NextResponse.json(
            { error: "Failed to fetch audit logs" },
            { status: 500 }
        );
    }
}
