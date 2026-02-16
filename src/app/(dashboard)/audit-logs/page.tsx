"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ScrollText,
    Search,
    Download,
    ChevronDown,
    ChevronUp,
    Clock,
    Filter,
    User,
    Database,
    Shield,
    Loader2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    description: string;
    changes?: Record<string, { old: unknown; new: unknown }>;
    createdAt: string;
    user: {
        name: string;
        email: string;
        role: string;
    };
    ipAddress?: string;
}

// ════════════════════════════════════════════════════════════════════════
// Action Colors
// ════════════════════════════════════════════════════════════════════════

const actionColors: Record<string, string> = {
    create: "bg-emerald-500/20 text-emerald-400",
    update: "bg-blue-500/20 text-blue-400",
    delete: "bg-red-500/20 text-red-400",
    approve: "bg-green-500/20 text-green-400",
    reject: "bg-orange-500/20 text-orange-400",
    login: "bg-purple-500/20 text-purple-400",
    export: "bg-cyan-500/20 text-cyan-400",
};

// ════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════

export default function AuditLogsPage() {
    const t = useTranslations('AuditLogs');
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [entityFilter, setEntityFilter] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const pageSize = 20;

    useEffect(() => {
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, actionFilter, entityFilter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageSize.toString(),
            });
            if (actionFilter) params.append("action", actionFilter);
            if (entityFilter) params.append("entityType", entityFilter);
            if (search) params.append("search", search);

            const res = await fetch(`/api/audit-logs?${params}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
                setTotal(data.total || 0);
            }
        } catch (error) {
            console.error("Failed to fetch audit logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        fetchLogs();
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams({ format: "csv" });
            if (actionFilter) params.append("action", actionFilter);
            if (entityFilter) params.append("entityType", entityFilter);

            const res = await fetch(`/api/audit-logs?${params}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setExporting(false);
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    const actions = ["create", "update", "delete", "approve", "reject", "login", "export"];
    const entities = ["Employee", "LeaveApplication", "Attendance", "SalarySlip", "ExpenseClaim", "JobPosting", "Goal"];

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Shield className="h-7 w-7 text-blue-400" />
                            {t('title')}
                        </h1>
                        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        disabled={exporting}
                        className="gap-2"
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {t('exportCSV')}
                    </Button>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: "Total Logs", value: total, icon: ScrollText, color: "from-blue-500 to-blue-600" },
                        { label: "Today", value: logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length, icon: Clock, color: "from-emerald-500 to-emerald-600" },
                        { label: "Users Active", value: new Set(logs.map(l => l.user?.email)).size, icon: User, color: "from-purple-500 to-purple-600" },
                        { label: "Entities", value: new Set(logs.map(l => l.entityType)).size, icon: Database, color: "from-amber-500 to-amber-600" },
                    ].map((s, i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br ${s.color} shadow-lg`}>
                                        <s.icon className="h-5 w-5 text-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-foreground">{s.value}</p>
                                        <p className="text-xs text-muted-foreground">{s.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search logs..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                    className="pl-10"
                                />
                            </div>
                            <select
                                value={actionFilter}
                                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                                className="h-10 px-3 rounded-lg bg-hover border border-card-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">All Actions</option>
                                {actions.map(a => (
                                    <option key={a} value={a} className="capitalize">{a}</option>
                                ))}
                            </select>
                            <select
                                value={entityFilter}
                                onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                                className="h-10 px-3 rounded-lg bg-hover border border-card-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">All Entities</option>
                                {entities.map(e => (
                                    <option key={e} value={e}>{e}</option>
                                ))}
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {/* Logs List */}
                <div className="space-y-2">
                    {loading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <Skeleton className="h-4 w-4 rounded" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-48" />
                                            <Skeleton className="h-3 w-72" />
                                        </div>
                                        <Skeleton className="h-6 w-16" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : logs.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <ScrollText className="h-12 w-12 text-tertiary-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">No audit logs found</p>
                            </CardContent>
                        </Card>
                    ) : (
                        logs.map((log) => {
                            const isExpanded = expandedId === log.id;
                            const hasChanges = log.changes && Object.keys(log.changes).length > 0;

                            return (
                                <Card key={log.id} className="hover:border-border transition-colors">
                                    <CardContent className="p-0">
                                        {/* Log Row */}
                                        <button
                                            className="w-full p-4 flex items-center gap-4 text-left"
                                            onClick={() => hasChanges && setExpandedId(isExpanded ? null : log.id)}
                                        >
                                            {/* Action Badge */}
                                            <Badge className={`${actionColors[log.action] || "bg-gray-500/20 text-gray-400"} text-[10px] uppercase shrink-0`}>
                                                {log.action}
                                            </Badge>

                                            {/* Description */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-foreground truncate">{log.description}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-muted-foreground">{log.user?.name || "System"}</span>
                                                    <span className="text-xs text-tertiary-foreground">•</span>
                                                    <Badge variant="default" className="text-[9px]">{log.entityType}</Badge>
                                                </div>
                                            </div>

                                            {/* Timestamp */}
                                            <div className="text-right shrink-0">
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(log.createdAt).toLocaleDateString()}
                                                </p>
                                                <p className="text-[10px] text-tertiary-foreground">
                                                    {new Date(log.createdAt).toLocaleTimeString()}
                                                </p>
                                            </div>

                                            {/* Expand */}
                                            {hasChanges && (
                                                <div className="shrink-0">
                                                    {isExpanded
                                                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    }
                                                </div>
                                            )}
                                        </button>

                                        {/* Expanded Changes */}
                                        {isExpanded && log.changes && (
                                            <div className="px-4 pb-4 border-t border-card-border">
                                                <div className="mt-3 rounded-lg overflow-hidden border border-card-border">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-hover">
                                                                <th className="text-left p-2 text-xs text-muted-foreground font-medium">Field</th>
                                                                <th className="text-left p-2 text-xs text-muted-foreground font-medium">Old Value</th>
                                                                <th className="text-left p-2 text-xs text-muted-foreground font-medium">New Value</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Object.entries(log.changes).map(([field, vals]) => (
                                                                <tr key={field} className="border-t border-card-border">
                                                                    <td className="p-2 text-xs font-medium text-foreground">{field}</td>
                                                                    <td className="p-2 text-xs text-red-400 line-through">
                                                                        {String(vals.old ?? "—")}
                                                                    </td>
                                                                    <td className="p-2 text-xs text-emerald-400">
                                                                        {String(vals.new ?? "—")}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                                const p = page <= 3 ? i + 1 : page - 2 + i;
                                if (p > totalPages || p < 1) return null;
                                return (
                                    <Button
                                        key={p}
                                        variant={p === page ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setPage(p)}
                                    >
                                        {p}
                                    </Button>
                                );
                            })}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
