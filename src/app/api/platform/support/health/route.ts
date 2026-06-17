/**
 * Platform Support Health API
 *
 * GET /api/platform/support/health?tenantId=...
 * Returns tenant health, package usage, sync-agent/device telemetry, and open issue summary.
 * Platform admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPlatformRequest, isPlatformVerified } from "@/lib/platform-token";
import { toPlainSettings } from "@/lib/settings-json";

type Severity = "healthy" | "warning" | "critical";

const MS_PER_HOUR = 60 * 60 * 1000;
const OPEN_ISSUE_STATUSES = ["open", "triaging", "in_progress", "waiting_on_client"];

function percent(current: number, limit: number) {
    if (limit === -1) return 0;
    if (limit <= 0) return current > 0 ? 100 : 0;
    return Math.round((current / limit) * 100);
}

function limitStatus(current: number, limit: number): Severity {
    if (limit === -1) return "healthy";
    if (current >= limit) return "critical";
    if (percent(current, limit) >= 85) return "warning";
    return "healthy";
}

function latestDate(...dates: Array<Date | null | undefined>) {
    return dates.filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
}

function subscriptionHealth(subscription: Awaited<ReturnType<typeof prisma.subscription.findFirst>>): Severity {
    if (!subscription) return "critical";
    const now = new Date();
    if (["canceled", "suspended", "expired"].includes(subscription.status)) return "critical";
    if (subscription.status === "past_due") return "warning";
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < now) return "critical";
    if (subscription.trialEnd && subscription.status === "trialing" && subscription.trialEnd < now) return "critical";
    const daysLeft = subscription.currentPeriodEnd
        ? Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (24 * MS_PER_HOUR))
        : null;
    if (daysLeft !== null && daysLeft <= 7) return "warning";
    return "healthy";
}

function overallSeverity(items: Severity[]): Severity {
    if (items.includes("critical")) return "critical";
    if (items.includes("warning")) return "warning";
    return "healthy";
}

function resolveCustomLimits(orgSettings: unknown) {
    const settings = toPlainSettings(orgSettings);
    const saasOverrides =
        typeof settings.saasOverrides === "object" && settings.saasOverrides !== null && !Array.isArray(settings.saasOverrides)
            ? (settings.saasOverrides as Record<string, unknown>)
            : {};
    const limits =
        typeof saasOverrides.limits === "object" && saasOverrides.limits !== null && !Array.isArray(saasOverrides.limits)
            ? (saasOverrides.limits as Record<string, number>)
            : {};
    return limits;
}

export async function GET(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || undefined;

    try {
        const organizations = await prisma.organization.findMany({
            where: tenantId ? { id: tenantId } : undefined,
            orderBy: { updatedAt: "desc" },
            include: {
                subscription: { include: { plan: true } },
                _count: {
                    select: {
                        employees: true,
                        users: true,
                        branches: true,
                        biometricDevices: true,
                    },
                },
            },
            take: tenantId ? 1 : 50,
        });

        const tenantIds = organizations.map((org) => org.id);

        const [syncKeys, devices, recentSyncLogs, recentCloudEvents, issueGroups, urgentIssues] = await Promise.all([
            prisma.syncApiKey.findMany({
                where: { organizationId: { in: tenantIds } },
                orderBy: [{ lastHeartbeat: "desc" }, { updatedAt: "desc" }],
                select: {
                    id: true,
                    name: true,
                    keyPrefix: true,
                    isActive: true,
                    lastHeartbeat: true,
                    lastSyncAt: true,
                    agentVersion: true,
                    agentIp: true,
                    syncCount: true,
                    totalRecords: true,
                    organizationId: true,
                },
            }),
            prisma.biometricDevice.findMany({
                where: { organizationId: { in: tenantIds } },
                orderBy: [{ lastSeenAt: "desc" }, { lastSyncAt: "desc" }],
                select: {
                    id: true,
                    name: true,
                    serialNumber: true,
                    ip: true,
                    connectionMode: true,
                    cloudStatus: true,
                    isActive: true,
                    isOnline: true,
                    consecutiveFailures: true,
                    lastSyncAt: true,
                    lastSyncStatus: true,
                    lastSeenAt: true,
                    lastPingAt: true,
                    organizationId: true,
                },
            }),
            prisma.deviceSyncLog.findMany({
                where: { device: { organizationId: { in: tenantIds } } },
                orderBy: { syncedAt: "desc" },
                take: 80,
                select: {
                    id: true,
                    status: true,
                    recordsSynced: true,
                    recordsSkipped: true,
                    errorMessage: true,
                    syncedAt: true,
                    device: { select: { id: true, name: true, organizationId: true } },
                },
            }),
            prisma.biometricCloudEvent.findMany({
                where: { organizationId: { in: tenantIds } },
                orderBy: { createdAt: "desc" },
                take: 80,
                select: {
                    id: true,
                    serialNumber: true,
                    eventType: true,
                    status: true,
                    recordsReceived: true,
                    recordsSynced: true,
                    recordsSkipped: true,
                    unmappedUserIds: true,
                    errorMessage: true,
                    createdAt: true,
                    organizationId: true,
                    device: { select: { id: true, name: true } },
                },
            }),
            prisma.platformSupportIssue.groupBy({
                by: ["organizationId", "status", "priority"],
                where: { organizationId: { in: tenantIds }, status: { in: OPEN_ISSUE_STATUSES } },
                _count: { _all: true },
            }),
            prisma.platformSupportIssue.findMany({
                where: { organizationId: { in: tenantIds }, status: { in: OPEN_ISSUE_STATUSES } },
                orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
                take: 20,
                select: {
                    id: true,
                    title: true,
                    category: true,
                    priority: true,
                    status: true,
                    scope: true,
                    nextAction: true,
                    createdAt: true,
                    organizationId: true,
                },
            }),
        ]);

        const now = Date.now();
        const health = organizations.map((org) => {
            const subscription = org.subscription;
            const plan = subscription?.plan;
            const customLimits = resolveCustomLimits(org.settings);
            const limits = plan
                ? {
                      employees: subscription?.maxEmployeesOverride ?? plan.maxEmployees,
                      admins: customLimits.maxAdmins ?? plan.maxAdmins,
                      branches: customLimits.maxBranches ?? plan.maxBranches,
                      devices: customLimits.maxDevices ?? plan.maxDevices,
                      storageMB: subscription?.maxStorageOverride ?? plan.maxStorageMB,
                  }
                : null;

            const orgSyncKeys = syncKeys.filter((item) => item.organizationId === org.id);
            const orgDevices = devices.filter((item) => item.organizationId === org.id);
            const orgSyncLogs = recentSyncLogs.filter((item) => item.device.organizationId === org.id);
            const orgCloudEvents = recentCloudEvents.filter((item) => item.organizationId === org.id);
            const orgIssueGroups = issueGroups.filter((item) => item.organizationId === org.id);
            const orgUrgentIssues = urgentIssues.filter((item) => item.organizationId === org.id);

            const latestSyncKey = orgSyncKeys[0];
            const lastAgentSeenAt = latestDate(...orgSyncKeys.map((key) => key.lastHeartbeat), ...orgSyncKeys.map((key) => key.lastSyncAt));
            const lastDeviceSeenAt = latestDate(...orgDevices.map((device) => device.lastSeenAt), ...orgDevices.map((device) => device.lastPingAt), ...orgDevices.map((device) => device.lastSyncAt));
            const lastSyncAt = latestDate(...orgSyncLogs.map((log) => log.syncedAt), ...orgSyncKeys.map((key) => key.lastSyncAt));
            const hoursSinceAgent = lastAgentSeenAt ? (now - lastAgentSeenAt.getTime()) / MS_PER_HOUR : null;

            const syncSeverity: Severity = orgDevices.length === 0 && orgSyncKeys.length === 0
                ? "warning"
                : hoursSinceAgent === null
                  ? "warning"
                  : hoursSinceAgent > 48
                    ? "critical"
                    : hoursSinceAgent > 12
                      ? "warning"
                      : "healthy";

            const failedSyncCount = orgSyncLogs.filter((log) => log.status === "failed").length;
            const partialSyncCount = orgSyncLogs.filter((log) => log.status === "partial").length;
            const unmappedUserIds = Array.from(new Set(orgCloudEvents.flatMap((event) => event.unmappedUserIds || [])));
            const failedCloudEvents = orgCloudEvents.filter((event) => ["failed", "unknown_device", "partial"].includes(event.status));
            const openIssueCount = orgIssueGroups.reduce((sum, group) => sum + group._count._all, 0);
            const urgentIssueCount = orgIssueGroups
                .filter((group) => ["urgent", "high"].includes(group.priority))
                .reduce((sum, group) => sum + group._count._all, 0);

            const usage = limits
                ? {
                      employees: { current: org._count.employees, limit: limits.employees, percentage: percent(org._count.employees, limits.employees), status: limitStatus(org._count.employees, limits.employees) },
                      admins: { current: org._count.users, limit: limits.admins, percentage: percent(org._count.users, limits.admins), status: limitStatus(org._count.users, limits.admins) },
                      branches: { current: org._count.branches, limit: limits.branches, percentage: percent(org._count.branches, limits.branches), status: limitStatus(org._count.branches, limits.branches) },
                      devices: { current: org._count.biometricDevices, limit: limits.devices, percentage: percent(org._count.biometricDevices, limits.devices), status: limitStatus(org._count.biometricDevices, limits.devices) },
                  }
                : null;

            const signals: Severity[] = [
                org.status === "active" ? "healthy" : "critical",
                subscriptionHealth(subscription),
                syncSeverity,
                urgentIssueCount > 0 ? "critical" : openIssueCount > 0 ? "warning" : "healthy",
                failedSyncCount > 0 || failedCloudEvents.length > 0 ? "warning" : "healthy",
                ...(usage ? Object.values(usage).map((item) => item.status) : ["critical" as Severity]),
            ];

            return {
                tenant: {
                    id: org.id,
                    name: org.name,
                    slug: org.slug,
                    status: org.status,
                    timezone: org.timezone,
                    updatedAt: org.updatedAt,
                },
                overallStatus: overallSeverity(signals),
                subscription: subscription
                    ? {
                          status: subscription.status,
                          planName: plan?.name ?? "Unknown plan",
                          planSlug: plan?.slug ?? "unknown",
                          currentPeriodEnd: subscription.currentPeriodEnd,
                          trialEnd: subscription.trialEnd,
                          health: subscriptionHealth(subscription),
                      }
                    : { status: "missing", planName: "No package", planSlug: "none", currentPeriodEnd: null, trialEnd: null, health: "critical" as Severity },
                usage,
                sync: {
                    status: syncSeverity,
                    lastAgentSeenAt,
                    lastDeviceSeenAt,
                    lastSyncAt,
                    activeAgents: orgSyncKeys.filter((key) => key.isActive).length,
                    totalAgents: orgSyncKeys.length,
                    activeDevices: orgDevices.filter((device) => device.isActive).length,
                    onlineDevices: orgDevices.filter((device) => device.isOnline).length,
                    totalDevices: orgDevices.length,
                    failedSyncCount,
                    partialSyncCount,
                    failedCloudEventCount: failedCloudEvents.length,
                    unmappedUserIds,
                    latestAgent: latestSyncKey
                        ? {
                              id: latestSyncKey.id,
                              name: latestSyncKey.name,
                              keyPrefix: latestSyncKey.keyPrefix,
                              lastHeartbeat: latestSyncKey.lastHeartbeat,
                              lastSyncAt: latestSyncKey.lastSyncAt,
                              agentVersion: latestSyncKey.agentVersion,
                              agentIp: latestSyncKey.agentIp,
                              syncCount: latestSyncKey.syncCount,
                              totalRecords: latestSyncKey.totalRecords,
                          }
                        : null,
                    devices: orgDevices.slice(0, 8),
                    recentErrors: [
                        ...orgSyncLogs
                            .filter((log) => log.status !== "success")
                            .slice(0, 5)
                            .map((log) => ({
                                id: log.id,
                                type: "device_sync",
                                status: log.status,
                                message: log.errorMessage || `${log.device.name} sync ${log.status}`,
                                createdAt: log.syncedAt,
                                deviceName: log.device.name,
                            })),
                        ...failedCloudEvents.slice(0, 5).map((event) => ({
                            id: event.id,
                            type: "cloud_event",
                            status: event.status,
                            message: event.errorMessage || `${event.eventType} ${event.status}`,
                            createdAt: event.createdAt,
                            deviceName: event.device?.name || event.serialNumber || "Unknown device",
                        })),
                    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
                },
                support: {
                    openIssueCount,
                    urgentIssueCount,
                    issuesByStatus: Object.fromEntries(orgIssueGroups.map((group) => [group.status, group._count._all])),
                    highlightedIssues: orgUrgentIssues,
                },
            };
        });

        const summary = {
            totalTenants: health.length,
            healthy: health.filter((item) => item.overallStatus === "healthy").length,
            warning: health.filter((item) => item.overallStatus === "warning").length,
            critical: health.filter((item) => item.overallStatus === "critical").length,
            openIssues: health.reduce((sum, item) => sum + item.support.openIssueCount, 0),
            urgentIssues: health.reduce((sum, item) => sum + item.support.urgentIssueCount, 0),
        };

        return NextResponse.json({ summary, tenants: health });
    } catch (error) {
        console.error("Platform support health failed", error);
        return NextResponse.json({ error: "Failed to load support health" }, { status: 500 });
    }
}
