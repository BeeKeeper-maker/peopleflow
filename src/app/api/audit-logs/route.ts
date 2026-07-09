import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { auditLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

// ✅ CSV injection protection
function escapeCsvField(value: string): string {
    const str = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(str)) {
        return `"'${str.replace(/"/g, '""')}"`;
    }
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * GET - Fetch audit logs with filters + server-side stats
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

        // Per-user rate limit (read op — audit logs can be a data-exfiltration
        // vector, so key on userId not IP)
        const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, ctx.userId);
        if (!rl.allowed) return rl.response;

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20") || 20), 100);
        const search = searchParams.get("search") || "";
        const action = searchParams.get("action") || "";
        const entityType = searchParams.get("entityType") || "";
        const userId = searchParams.get("userId") || "";
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const format = searchParams.get("format");

        const orgFilter = { organizationId: ctx.organizationId };

        // Build where clause
        const where: Record<string, unknown> = { ...orgFilter };

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

        // ── CSV Export ────────────────────────────────────────────────────
        if (format === "csv") {
            const csvBundle = await ctx.withDB(async (db) => {
                const allLogs = await db.auditLog.findMany({
                    where: where as any,
                    orderBy: { createdAt: "desc" },
                    take: 5000,
                });

                const logUserIds = [...new Set(allLogs.filter(l => l.userId).map(l => l.userId!))];
                const users = logUserIds.length > 0
                    ? await db.user.findMany({
                        where: { id: { in: logUserIds } },
                        select: { id: true, name: true, email: true },
                    })
                    : [];
                return { allLogs, users };
            });
            const { allLogs, users } = csvBundle;
            const userMap = new Map(users.map(u => [u.id, u]));

            const csvHeaders = "Date,Time,Action,Entity Type,Entity ID,Performed By,IP Address,User Agent";
            const csvRows = allLogs.map(log => {
                const date = new Date(log.createdAt);
                const user = log.userId ? userMap.get(log.userId) : null;
                return [
                    escapeCsvField(date.toLocaleDateString("en-GB")),
                    escapeCsvField(date.toLocaleTimeString("en-GB")),
                    escapeCsvField(log.action),
                    escapeCsvField(log.entityType),
                    escapeCsvField(log.entityId || ""),
                    escapeCsvField(user?.name || user?.email || "System"),
                    escapeCsvField(log.ipAddress || ""),
                    escapeCsvField(log.userAgent || ""),
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

        // ── Paginated JSON + Server-Side Stats ───────────────────────────
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const statsBundle = await ctx.withDB(async (db) => {
            const [logs, total, todayCount, criticalCount, activeUsersRaw, filterActions, filterEntities] = await Promise.all([
                db.auditLog.findMany({
                    where: where as any,
                    orderBy: { createdAt: "desc" },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                db.auditLog.count({ where: where as any }),
                // Today's log count
                db.auditLog.count({
                    where: { ...orgFilter, createdAt: { gte: todayStart } } as any,
                }),
                // Critical actions count (delete, approve, reject)
                db.auditLog.count({
                    where: {
                        ...orgFilter,
                        action: { in: ["delete", "approve", "reject"] },
                        createdAt: { gte: todayStart },
                    } as any,
                }),
                // Active users today (distinct userIds)
                db.auditLog.findMany({
                    where: { ...orgFilter, createdAt: { gte: todayStart }, userId: { not: null } } as any,
                    select: { userId: true },
                    distinct: ["userId"],
                }),
                // Filter options
                db.auditLog.findMany({
                    where: orgFilter as any,
                    select: { action: true },
                    distinct: ["action"],
                }),
                db.auditLog.findMany({
                    where: orgFilter as any,
                    select: { entityType: true },
                    distinct: ["entityType"],
                }),
            ]);
            return { logs, total, todayCount, criticalCount, activeUsersRaw, filterActions, filterEntities };
        });
        const { logs, total, todayCount, criticalCount, activeUsersRaw, filterActions, filterEntities } = statsBundle;

        // Lookup user names for log entries
        const logUserIds = [...new Set(logs.filter(l => l.userId).map(l => l.userId!))];
        const users = logUserIds.length > 0
            ? await ctx.withDB((db) =>
                db.user.findMany({
                    where: { id: { in: logUserIds } },
                    select: { id: true, name: true, email: true },
                }),
            )
            : [];
        const userMap = new Map(users.map(u => [u.id, u]));

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
            stats: {
                total,
                todayCount,
                criticalCount,
                activeUsers: activeUsersRaw.length,
            },
            filters: {
                actions: filterActions.map(a => a.action),
                entityTypes: filterEntities.map(e => e.entityType),
            },
        });
    } catch (error) {
        auditLogger.error({ err: error }, "Audit log error:");
        return NextResponse.json(
            { error: "Failed to fetch audit logs" },
            { status: 500 }
        );
    }
}
