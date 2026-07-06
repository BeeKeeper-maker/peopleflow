"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ScrollText, Search, Filter, Activity, Shield, UserCog, CreditCard, Power, X } from "lucide-react";

interface AuditLog {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    platformAdmin: { name: string; email: string };
}

const ACTION_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
    "tenant": { icon: Shield, color: "text-indigo-400" },
    "subscription": { icon: CreditCard, color: "text-violet-400" },
    "impersonation": { icon: UserCog, color: "text-amber-400" },
    "status": { icon: Power, color: "text-red-400" },
};

function getActionMeta(action: string) {
    const key = Object.keys(ACTION_ICONS).find(k => action.includes(k));
    return ACTION_ICONS[key || ""] || { icon: Activity, color: "text-zinc-400" };
}

export default function AuditLogsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [targetTypeFilter, setTargetTypeFilter] = useState("");
    const [targetIdFilter, setTargetIdFilter] = useState("");

    // Read URL params on mount (for deep links from tenant detail page)
    useEffect(() => {
        const tt = searchParams.get("targetType");
        const ti = searchParams.get("targetId");
        const af = searchParams.get("action");
        if (tt) setTargetTypeFilter(tt);
        if (ti) setTargetIdFilter(ti);
        if (af) setActionFilter(af);
    }, [searchParams]);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ limit: "50" });
        if (actionFilter) params.set("action", actionFilter);
        if (targetTypeFilter) params.set("targetType", targetTypeFilter);
        if (targetIdFilter) params.set("targetId", targetIdFilter);
        try {
            const res = await fetch(`/api/platform/audit-logs?${params}`, { credentials: "include" });
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [actionFilter, targetTypeFilter, targetIdFilter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const clearFilters = () => {
        setActionFilter("");
        setTargetTypeFilter("");
        setTargetIdFilter("");
        // Clear URL params too
        router.replace("/platform/audit-logs");
    };

    const hasActiveFilters = !!(actionFilter || targetTypeFilter || targetIdFilter);

    const filteredLogs = search
        ? logs.filter(l => l.action.includes(search) || l.platformAdmin.name.toLowerCase().includes(search.toLowerCase()))
        : logs;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Audit Logs</h1>
                <p className="text-sm text-zinc-500 mt-1">Complete audit trail for all platform actions</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions..."
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                </div>
                <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
                    className="h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-400 focus:outline-none appearance-none">
                    <option value="">All Actions</option>
                    <option value="tenant">Tenant</option>
                    <option value="subscription">Subscription</option>
                    <option value="impersonation">Impersonation</option>
                </select>
                <select value={targetTypeFilter} onChange={e => setTargetTypeFilter(e.target.value)}
                    className="h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-400 focus:outline-none appearance-none">
                    <option value="">All Target Types</option>
                    <option value="organization">Organization</option>
                    <option value="subscription">Subscription</option>
                    <option value="platform_admin">Platform Admin</option>
                </select>
                {targetIdFilter && (
                    <div className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                        <Filter className="w-3.5 h-3.5" />
                        <span className="font-mono">targetId: {targetIdFilter.slice(0, 12)}...</span>
                    </div>
                )}
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                        Clear
                    </button>
                )}
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="space-y-0">
                    {loading ? [...Array(8)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.03]">
                            <div className="w-9 h-9 rounded-full bg-white/[0.04] animate-pulse" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-2/3 rounded bg-white/[0.04] animate-pulse" />
                                <div className="h-3 w-1/3 rounded bg-white/[0.03] animate-pulse" />
                            </div>
                        </div>
                    )) : filteredLogs.map(log => {
                        const meta = getActionMeta(log.action);
                        const Icon = meta.icon;
                        return (
                            <div key={log.id} className="flex items-start gap-4 px-5 py-4 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                <div className={`w-9 h-9 rounded-full bg-white/[0.04] flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                    <Icon className={`w-4 h-4 ${meta.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-zinc-300">
                                        <span className="text-white font-medium">{log.platformAdmin?.name}</span>
                                        {" "}
                                        <span className="text-zinc-500">performed</span>
                                        {" "}
                                        <span className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                            {log.action}
                                        </span>
                                        {" "}
                                        <span className="text-zinc-500">on</span>
                                        {" "}
                                        <span className="text-zinc-300">{log.targetType}</span>
                                    </p>
                                    <p className="text-xs text-zinc-600 mt-1 font-mono">{log.targetId}</p>
                                </div>
                                <span className="text-xs text-zinc-600 tabular-nums whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleString()}
                                </span>
                            </div>
                        );
                    })}
                    {!loading && filteredLogs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                            <ScrollText className="w-10 h-10 mb-3" />
                            <p className="text-sm">No audit logs found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
