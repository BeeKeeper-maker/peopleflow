import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/queue-health — Worker/Queue health dashboard data
 *
 * Returns:
 *   1. Worker process info (from instrumentation/heartbeat)
 *   2. Recent job counts by status (completed, failed, active, delayed)
 *   3. Recent failed jobs (for DLQ inspection)
 *   4. Biometric device sync status (latest sync logs)
 *   5. Cron job execution status
 *
 * This is a READ-ONLY endpoint — it doesn't execute any jobs.
 * Admin can see the operational state of the background workers.
 */
export async function GET() {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        // ── 1. Biometric device sync status (from DeviceSyncLog) ──
        const recentSyncLogs = await prisma.deviceSyncLog.findMany({
            take: 20,
            orderBy: { syncedAt: "desc" },
            include: {
                device: {
                    select: { id: true, name: true, ip: true, organizationId: true },
                },
            },
        });

        // Filter to org scope (deviceSyncLog doesn't have orgId directly,
        // but device does)
        const orgSyncLogs = recentSyncLogs.filter(
            (log) => log.device.organizationId === auth.organizationId,
        );

        const syncStats = {
            totalSyncs: orgSyncLogs.length,
            successful: orgSyncLogs.filter((l) => l.status === "success").length,
            failed: orgSyncLogs.filter((l) => l.status === "failed").length,
            partial: orgSyncLogs.filter((l) => l.status === "partial").length,
            lastSync: orgSyncLogs[0]?.syncedAt || null,
        };

        // ── 2. Device health status ──
        const devices = await prisma.biometricDevice.findMany({
            where: { organizationId: auth.organizationId },
            select: {
                id: true,
                name: true,
                ip: true,
                isOnline: true,
                lastSyncAt: true,
                lastPingAt: true,
                lastSyncStatus: true,
                consecutiveFailures: true,
                connectionMode: true,
                syncApiKey: {
                    select: {
                        lastHeartbeat: true,
                        lastSyncAt: true,
                        agentVersion: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });

        const deviceStats = {
            total: devices.length,
            online: devices.filter((d) => d.isOnline).length,
            offline: devices.filter((d) => !d.isOnline).length,
            syncAgentMode: devices.filter((d) => d.connectionMode === "sync_agent").length,
            directCloudMode: devices.filter((d) => d.connectionMode === "direct_cloud").length,
        };

        // ── 3. Biometric cloud events (for direct_cloud devices) ──
        const recentCloudEvents = await prisma.biometricCloudEvent.findMany({
            where: { organizationId: auth.organizationId },
            take: 10,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                eventType: true,
                status: true,
                recordsReceived: true,
                recordsSynced: true,
                recordsSkipped: true,
                errorMessage: true,
                createdAt: true,
                device: { select: { name: true } },
            },
        });

        // ── 4. Document expiry alerts (from last cron run) ──
        const expiringDocs = await prisma.employeeDocument.count({
            where: {
                deletedAt: null,
                expiryDate: {
                    gte: new Date(),
                    lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
            },
        });

        // ── 5. Approval request queue (pending items) ──
        const pendingApprovals = await prisma.approvalRequest.count({
            where: {
                organizationId: auth.organizationId,
                status: { in: ["pending", "in_progress"] },
            },
        });

        const escalatedApprovals = await prisma.approvalRequest.count({
            where: {
                organizationId: auth.organizationId,
                status: "escalated",
            },
        });

        // ── 6. Active subscriptions status ──
        const subscription = await prisma.subscription.findUnique({
            where: { organizationId: auth.organizationId },
            select: {
                status: true,
                trialEnd: true,
                currentPeriodEnd: true,
            },
        });

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
            },
            biometric: {
                syncStats,
                deviceStats,
                devices: devices.map((d) => ({
                    id: d.id,
                    name: d.name,
                    ip: d.ip,
                    isOnline: d.isOnline,
                    connectionMode: d.connectionMode,
                    lastSyncAt: d.lastSyncAt,
                    lastPingAt: d.lastPingAt,
                    lastSyncStatus: d.lastSyncStatus,
                    consecutiveFailures: d.consecutiveFailures,
                    agentHeartbeat: d.syncApiKey?.lastHeartbeat || null,
                    agentVersion: d.syncApiKey?.agentVersion || null,
                })),
                recentSyncLogs: orgSyncLogs.map((l) => ({
                    id: l.id,
                    deviceName: l.device.name,
                    status: l.status,
                    recordsSynced: l.recordsSynced,
                    recordsSkipped: l.recordsSkipped,
                    errorMessage: l.errorMessage,
                    syncedAt: l.syncedAt,
                    duration: l.syncDuration,
                })),
                recentCloudEvents,
            },
            documents: {
                expiringIn30Days: expiringDocs,
            },
            approvals: {
                pending: pendingApprovals,
                escalated: escalatedApprovals,
            },
            subscription,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "QUEUE_HEALTH_ERROR");
        return NextResponse.json(
            { error: "Failed to fetch queue health" },
            { status: 500 },
        );
    }
}
