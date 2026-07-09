"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    Building2,
    MoreVertical,
    Users,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Power,
    Eye,
    Plus,
} from "lucide-react";
import { ProvisionTenantModal } from "./_components/provision-modal";

interface Tenant {
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
    lastActiveAt: string | null;
    onboardingStatus: "not_started" | "in_progress" | "active";
    _count: { employees: number; users: number };
    subscription: {
        status: string;
        plan: { name: string; slug: string };
    } | null;
}

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    active: { dot: "bg-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Active" },
    trialing: { dot: "bg-blue-400", bg: "bg-blue-500/10", text: "text-blue-400", label: "Trial" },
    suspended: { dot: "bg-red-400", bg: "bg-red-500/10", text: "text-red-400", label: "Suspended" },
    deactivated: { dot: "bg-zinc-500", bg: "bg-zinc-500/10", text: "text-muted-foreground", label: "Deactivated" },
};

const ONBOARDING_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
    not_started: { bg: "bg-zinc-500/10", text: "text-muted-foreground", label: "Not Started" },
    in_progress: { bg: "bg-amber-500/10", text: "text-amber-400", label: "In Progress" },
    active: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Active" },
};

function formatLastActive(dateStr: string | null): { text: string; color: string } {
    if (!dateStr) return { text: "Never", color: "text-muted-foreground" };
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return { text: "Just now", color: "text-emerald-400" };
    if (diffMins < 60) return { text: `${diffMins}m ago`, color: "text-emerald-400" };
    if (diffHours < 24) return { text: `${diffHours}h ago`, color: "text-emerald-400" };
    if (diffDays === 1) return { text: "Yesterday", color: "text-muted-foreground" };
    if (diffDays < 7) return { text: `${diffDays}d ago`, color: "text-muted-foreground" };
    if (diffDays < 30) return { text: `${Math.floor(diffDays / 7)}w ago`, color: "text-amber-400" };
    return { text: `${Math.floor(diffDays / 30)}mo ago`, color: "text-red-400" };
}

export default function TenantsPage() {
    const router = useRouter();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [showProvisionModal, setShowProvisionModal] = useState(false);
    const limit = 20;

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search) params.set("search", search);
        if (statusFilter !== "all") params.set("status", statusFilter);

        try {
            const res = await fetch(`/api/platform/tenants?${params}`, { credentials: "include" });
            const data = await res.json();
            setTenants(data.tenants || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error("Failed to fetch tenants:", err);
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter]);

    useEffect(() => { fetchTenants(); }, [fetchTenants]);

    // Debounced search
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); fetchTenants(); }, 300);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Tenants</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage all organizations on the platform
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Building2 className="w-4 h-4" />
                        <span className="tabular-nums">{total} total</span>
                    </div>
                    <button
                        onClick={() => setShowProvisionModal(true)}
                        className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-sm text-white font-medium transition shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Provision Tenant
                    </button>
                </div>
            </div>

            {/* Provision Modal */}
            <ProvisionTenantModal
                isOpen={showProvisionModal}
                onClose={() => setShowProvisionModal(false)}
                onSuccess={() => fetchTenants()}
            />

            {/* Filters Bar */}
            <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or slug..."
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-hover border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-hover border border-border">
                    {["all", "active", "trialing", "suspended"].map((s) => (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                statusFilter === s
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "text-muted-foreground hover:text-foreground hover:bg-hover"
                            }`}
                        >
                            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-hover/50 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Organization</th>
                            <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Plan</th>
                            <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                            <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Onboarding</th>
                            <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Employees</th>
                            <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Last Active</th>
                            <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Created</th>
                            <th className="w-12 px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? [...Array(5)].map((_, i) => (
                                <tr key={i} className="border-b border-white/[0.03]">
                                    {[...Array(8)].map((_, j) => (
                                        <td key={j} className="px-5 py-4">
                                            <div className="h-4 rounded bg-hover animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                            : tenants.map((tenant) => {
                                const status = STATUS_CONFIG[tenant.status] || STATUS_CONFIG.active;
                                const onboarding = ONBOARDING_CONFIG[tenant.onboardingStatus] || ONBOARDING_CONFIG.not_started;
                                const lastActive = formatLastActive(tenant.lastActiveAt);
                                return (
                                    <tr
                                        key={tenant.id}
                                        className="border-b border-white/[0.03] hover:bg-hover/50 transition-colors cursor-pointer group"
                                        onClick={() => router.push(`/platform/tenants/${tenant.id}`)}
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 flex-shrink-0">
                                                    {tenant.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground group-hover:text-indigo-300 transition-colors">
                                                        {tenant.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground font-mono">{tenant.slug}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm text-foreground">
                                                {tenant.subscription?.plan?.name || "—"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${status.bg} ${status.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${onboarding.bg} ${onboarding.text}`}>
                                                {onboarding.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                                <span className="tabular-nums">{tenant._count?.employees || 0}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`text-sm tabular-nums ${lastActive.color}`}>
                                                {lastActive.text}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-muted-foreground tabular-nums">
                                            {new Date(tenant.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); router.push(`/platform/tenants/${tenant.id}`); }}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                                                    title="View details"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>

                {/* Empty State */}
                {!loading && tenants.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Building2 className="w-10 h-10 mb-3" />
                        <p className="text-sm font-medium">No tenants found</p>
                        <p className="text-xs mt-1">
                            {search ? "Try adjusting your search" : "Provision your first tenant to get started"}
                        </p>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                                className="w-8 h-8 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover disabled:opacity-30 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs text-muted-foreground tabular-nums px-2">
                                {page} / {totalPages}
                            </span>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                                className="w-8 h-8 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover disabled:opacity-30 transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
