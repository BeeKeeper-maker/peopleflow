import { NextResponse } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { getRedis, isRedisDisabledForRuntime } from "@/lib/redis";
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/system-stats — Monitoring dashboard data
 *
 * Returns a READ-ONLY snapshot of system health for the admin/HR
 * monitoring dashboard:
 *
 *   1. Database row counts (RLS-scoped to the caller's organization)
 *   2. Redis connection state + aggregate BullMQ queue depth
 *   3. Node.js process info (uptime, memory, version, env)
 *
 * Security:
 *   - Requires `requireAdminOrHR` (super_admin / admin / hr_admin only)
 *   - All DB queries go through `auth.withDB()` so RLS enforces
 *     tenant isolation; no cross-tenant counts are ever returned.
 *   - No DB credentials, connection strings, or Redis URLs are exposed.
 */
export async function GET() {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const stats = {
            timestamp: new Date().toISOString(),
            database: {
                totalEmployees: 0,
                activeEmployees: 0,
                totalAttendanceToday: 0,
                totalLeaveApplications: 0,
                pendingApprovals: 0,
                totalSalarySlips: 0,
            },
            redis: {
                connected: false,
                queueDepth: 0,
            },
            system: {
                uptime: process.uptime(),
                memoryUsage: {
                    rss: process.memoryUsage().rss,
                    heapUsed: process.memoryUsage().heapUsed,
                    heapTotal: process.memoryUsage().heapTotal,
                },
                nodeVersion: process.version,
                environment: process.env.NODE_ENV ?? "development",
            },
        };

        // ── 1. Database stats (RLS-enforced via auth.withDB) ──
        await auth.withDB(async (db) => {
            stats.database.totalEmployees = await db.employee.count({
                where: {
                    organizationId: auth.organizationId,
                    deletedAt: null,
                },
            });

            stats.database.activeEmployees = await db.employee.count({
                where: {
                    organizationId: auth.organizationId,
                    deletedAt: null,
                    employmentStatus: "active",
                },
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            stats.database.totalAttendanceToday = await db.attendance.count({
                where: {
                    organizationId: auth.organizationId,
                    date: today,
                },
            });

            stats.database.totalLeaveApplications =
                await db.leaveApplication.count({
                    where: { organizationId: auth.organizationId },
                });

            stats.database.pendingApprovals = await db.approvalRequest.count({
                where: {
                    organizationId: auth.organizationId,
                    status: "pending",
                },
            });

            stats.database.totalSalarySlips = await db.salarySlip.count({
                where: {
                    organizationId: auth.organizationId,
                    deletedAt: null,
                },
            });
        });

        // ── 2. Redis + BullMQ queue depth ──
        // BullMQ stores waiting jobs in a Redis list named `bull:<queue>:wait`.
        // Summing LLEN across the operational queues gives a single depth
        // metric for the dashboard. We deliberately skip queues that don't
        // exist yet (Redis returns 0 for LLEN on missing keys).
        try {
            if (!isRedisDisabledForRuntime()) {
                const redis = getRedis();
                stats.redis.connected = redis.status === "ready";

                const queueNames = [
                    "event-pipeline",
                    "biometric-sync",
                    "subscription-lifecycle",
                    "attendance-reconciliation",
                    "notifications",
                    "device-health",
                    "usage-tracking",
                    "impersonation-cleanup",
                ];

                for (const name of queueNames) {
                    const count = await redis.llen(`bull:${name}:wait`);
                    stats.redis.queueDepth += count;
                }
            }
        } catch (error) {
            // Redis unavailable — leave connected=false and queueDepth=0
            apiLogger.warn(
                { err: error },
                "SYSTEM_STATS_REDIS_UNAVAILABLE",
            );
            stats.redis.connected = false;
        }

        return NextResponse.json(stats);
    } catch (error) {
        apiLogger.error({ err: error }, "SYSTEM_STATS_ERROR");
        return NextResponse.json(
            { error: "Failed to fetch system stats" },
            { status: 500 },
        );
    }
}
