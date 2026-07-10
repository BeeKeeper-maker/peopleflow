"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Activity,
    Server,
    HardDrive,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    Fingerprint,
    FileText,
    GitPullRequest,
    CreditCard,
} from "lucide-react";

interface QueueHealth {
    timestamp: string;
    uptime: number;
    memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number };
    biometric: {
        syncStats: {
            totalSyncs: number;
            successful: number;
            failed: number;
            partial: number;
            lastSync: string | null;
        };
        deviceStats: {
            total: number;
            online: number;
            offline: number;
            syncAgentMode: number;
            directCloudMode: number;
        };
        devices: Array<{
            id: string;
            name: string;
            ip: string;
            isOnline: boolean;
            connectionMode: string;
            lastSyncAt: string | null;
            lastPingAt: string | null;
            lastSyncStatus: string | null;
            consecutiveFailures: number;
            agentHeartbeat: string | null;
            agentVersion: string | null;
        }>;
        recentSyncLogs: Array<{
            id: string;
            deviceName: string;
            status: string;
            recordsSynced: number;
            recordsSkipped: number;
            errorMessage: string | null;
            syncedAt: string;
            duration: number | null;
        }>;
        recentCloudEvents: Array<{
            id: string;
            eventType: string;
            status: string;
            recordsReceived: number;
            recordsSynced: number;
            errorMessage: string | null;
            createdAt: string;
            device: { name: string } | null;
        }>;
    };
    documents: { expiringIn30Days: number };
    approvals: { pending: number; escalated: number };
    subscription: { status: string; trialEnd: string | null; currentPeriodEnd: string | null } | null;
}

export default function QueueHealthPage() {
    const { addToast } = useToast();
    const [health, setHealth] = useState<QueueHealth | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/queue-health");
            if (res.ok) {
                setHealth(await res.json());
            }
        } catch {
            addToast({ title: "Error", description: "Failed to load health data", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000); // Auto-refresh every 30s
        return () => clearInterval(interval);
    }, [fetchHealth]);

    if (loading || !health) {
        return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div>;
    }

    const uptimeHours = Math.floor(health.uptime / 3600);
    const uptimeMins = Math.floor((health.uptime % 3600) / 60);

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <Activity className="h-6 w-6" />
                        System Health
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Real-time monitoring of workers, queues, and system resources.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchHealth}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* System Stats */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    icon={<Server className="h-5 w-5" />}
                    label="Uptime"
                    value={`${uptimeHours}h ${uptimeMins}m`}
                />
                <StatCard
                    icon={<HardDrive className="h-5 w-5" />}
                    label="Memory (Heap)"
                    value={`${health.memory.heapUsedMB} / ${health.memory.heapTotalMB} MB`}
                    warning={health.memory.heapUsedMB / health.memory.heapTotalMB > 0.85}
                />
                <StatCard
                    icon={<Clock className="h-5 w-5" />}
                    label="Last Updated"
                    value={new Date(health.timestamp).toLocaleTimeString()}
                />
                <StatCard
                    icon={<CreditCard className="h-5 w-5" />}
                    label="Subscription"
                    value={health.subscription?.status || "—"}
                    warning={health.subscription?.status === "expired" || health.subscription?.status === "past_due"}
                />
            </div>

            {/* Biometric Devices */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Fingerprint className="h-5 w-5" />
                        Biometric Devices
                        <Badge variant="secondary">{health.biometric.deviceStats.total} total</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-green-400" />} label="Online" value={String(health.biometric.deviceStats.online)} />
                        <StatCard icon={<XCircle className="h-4 w-4 text-red-400" />} label="Offline" value={String(health.biometric.deviceStats.offline)} />
                        <StatCard icon={<Activity className="h-4 w-4 text-blue-400" />} label="Sync Agent" value={String(health.biometric.deviceStats.syncAgentMode)} />
                        <StatCard icon={<Activity className="h-4 w-4 text-purple-400" />} label="Direct Cloud" value={String(health.biometric.deviceStats.directCloudMode)} />
                    </div>

                    {health.biometric.devices.length > 0 ? (
                        <div className="space-y-2">
                            {health.biometric.devices.map((device) => (
                                <div
                                    key={device.id}
                                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-hover/30"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${device.isOnline ? "bg-green-500" : "bg-red-500"}`} />
                                        <div>
                                            <div className="font-medium text-sm">{device.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {device.ip} · {device.connectionMode}
                                                {device.agentVersion && ` · agent v${device.agentVersion}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground">
                                            Last sync: {device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : "Never"}
                                        </div>
                                        {device.consecutiveFailures > 0 && (
                                            <Badge variant="outline" className="text-xs text-red-400 border-red-400/30 mt-1">
                                                {device.consecutiveFailures} failures
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No devices registered</p>
                    )}
                </CardContent>
            </Card>

            {/* Recent Sync Logs */}
            {health.biometric.recentSyncLogs.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Sync Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            {health.biometric.recentSyncLogs.slice(0, 10).map((log) => (
                                <div key={log.id} className="flex items-center justify-between py-1.5 px-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        {log.status === "success" && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                                        {log.status === "failed" && <XCircle className="h-3 w-3 text-red-400" />}
                                        {log.status === "partial" && <AlertTriangle className="h-3 w-3 text-yellow-400" />}
                                        <span>{log.deviceName}</span>
                                        <span className="text-muted-foreground text-xs">
                                            {log.recordsSynced} synced, {log.recordsSkipped} skipped
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(log.syncedAt).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Other Queues */}
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4" />
                            Documents
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-display font-bold tabular-nums">{health.documents.expiringIn30Days}</div>
                        <p className="text-sm text-muted-foreground">expiring in 30 days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <GitPullRequest className="h-4 w-4" />
                            Approvals
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4">
                            <div>
                                <div className="text-2xl font-display font-bold tabular-nums">{health.approvals.pending}</div>
                                <p className="text-sm text-muted-foreground">pending</p>
                            </div>
                            <div>
                                <div className="text-2xl font-display font-bold text-red-400">{health.approvals.escalated}</div>
                                <p className="text-sm text-muted-foreground">escalated</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    warning,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    warning?: boolean;
}) {
    return (
        <Card className={warning ? "border-yellow-500/30" : ""}>
            <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    {icon}
                    <span>{label}</span>
                </div>
                <div className={`text-xl font-bold tabular-nums mt-1 ${warning ? "text-yellow-400" : ""}`}>
                    {value}
                </div>
            </CardContent>
        </Card>
    );
}
