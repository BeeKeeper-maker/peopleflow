"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Activity,
    Database,
    Server,
    RefreshCw,
    Loader2,
    Users,
    UserCheck,
    CalendarCheck,
    FileText,
    Clock3,
    Receipt,
} from "lucide-react";

interface SystemStats {
    timestamp: string;
    database: {
        totalEmployees: number;
        activeEmployees: number;
        totalAttendanceToday: number;
        totalLeaveApplications: number;
        pendingApprovals: number;
        totalSalarySlips: number;
    };
    redis: {
        connected: boolean;
        queueDepth: number;
    };
    system: {
        uptime: number;
        memoryUsage: { rss: number; heapUsed: number; heapTotal: number };
        nodeVersion: string;
        environment: string;
    };
}

export default function SystemMonitorPage() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/system-stats");
            if (res.ok) setStats(await res.json());
        } catch {
            // Silent — monitoring page should not block on toast noise.
            // The empty state and "Disconnected" badges communicate failure.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30_000); // 30s auto-refresh
        return () => clearInterval(interval);
    }, [fetchStats]);

    const formatBytes = (bytes: number) => {
        if (!Number.isFinite(bytes)) return "—";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    };

    const formatUptime = (seconds: number) => {
        if (!Number.isFinite(seconds)) return "—";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="System Monitor"
                subtitle="Real-time system health and performance metrics"
                icon={Activity}
                iconColor="blue"
                actions={
                    <Button
                        variant="outline"
                        onClick={fetchStats}
                        disabled={loading}
                        className="gap-2"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        Refresh
                    </Button>
                }
            />

            {/* Database Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <DatabaseStatCard
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="Total Employees"
                    value={stats?.database.totalEmployees}
                />
                <DatabaseStatCard
                    icon={<UserCheck className="h-3.5 w-3.5" />}
                    label="Active Employees"
                    value={stats?.database.activeEmployees}
                    accent="emerald"
                />
                <DatabaseStatCard
                    icon={<CalendarCheck className="h-3.5 w-3.5" />}
                    label="Attendance Today"
                    value={stats?.database.totalAttendanceToday}
                    accent="blue"
                />
                <DatabaseStatCard
                    icon={<FileText className="h-3.5 w-3.5" />}
                    label="Leave Applications"
                    value={stats?.database.totalLeaveApplications}
                />
                <DatabaseStatCard
                    icon={<Clock3 className="h-3.5 w-3.5" />}
                    label="Pending Approvals"
                    value={stats?.database.pendingApprovals}
                    accent="amber"
                />
                <DatabaseStatCard
                    icon={<Receipt className="h-3.5 w-3.5" />}
                    label="Salary Slips"
                    value={stats?.database.totalSalarySlips}
                />
            </div>

            {/* Redis + System */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-card-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Database className="h-4 w-4 text-blue-400" />
                            Redis
                            <Badge
                                className={
                                    stats?.redis.connected
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : "bg-red-500/15 text-red-400"
                                }
                            >
                                {stats?.redis.connected
                                    ? "Connected"
                                    : "Disconnected"}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Queue Depth
                            </span>
                            <span className="font-medium text-foreground tabular-nums">
                                {stats?.redis.queueDepth ?? "—"}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-card-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Server className="h-4 w-4 text-purple-400" />
                            System
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Uptime
                            </span>
                            <span className="font-medium text-foreground">
                                {stats ? formatUptime(stats.system.uptime) : "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Memory (RSS)
                            </span>
                            <span className="font-medium text-foreground">
                                {stats
                                    ? formatBytes(stats.system.memoryUsage.rss)
                                    : "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Heap Used
                            </span>
                            <span className="font-medium text-foreground">
                                {stats
                                    ? formatBytes(
                                          stats.system.memoryUsage.heapUsed,
                                      )
                                    : "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Node Version
                            </span>
                            <span className="font-medium text-foreground">
                                {stats?.system.nodeVersion ?? "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Environment
                            </span>
                            <Badge variant="outline">
                                {stats?.system.environment ?? "—"}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Last Updated */}
            {stats && (
                <p className="text-xs text-muted-foreground text-center">
                    Last updated:{" "}
                    {new Date(stats.timestamp).toLocaleString()} ·
                    Auto-refreshes every 30s
                </p>
            )}
        </div>
    );
}

// ── Stat card subcomponent (design-system tokens) ─────────────────

const ACCENT_TEXT: Record<string, string> = {
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
    default: "text-foreground",
};

function DatabaseStatCard({
    icon,
    label,
    value,
    accent = "default",
}: {
    icon: React.ReactNode;
    label: string;
    value: number | undefined;
    accent?: "emerald" | "blue" | "amber" | "default";
}) {
    const valueClass = ACCENT_TEXT[accent] ?? ACCENT_TEXT.default;
    return (
        <Card className="border-card-border">
            <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {icon}
                    <span>{label}</span>
                </div>
                <p
                    className={`text-2xl font-display font-bold mt-1 tabular-nums ${valueClass}`}
                >
                    {value ?? "—"}
                </p>
            </CardContent>
        </Card>
    );
}
