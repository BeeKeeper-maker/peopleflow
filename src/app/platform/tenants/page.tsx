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
    deactivated: { dot: "bg-zinc-500", bg: "bg-zinc-500/10", text: "text-zinc-400", label: "Deactivated" },
};

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
                    <h1 className="text-2xl font-bold text-white tracking-tight">Tenants</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Manage all organizations on the platform
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or slug..."
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    {["all", "active", "trialing", "suspended"].map((s) => (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                statusFilter === s
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                            }`}
                        >
                            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/[0.06]">
                            <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-5 py-3">Organization</th>
                            <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-5 py-3">Plan</th>
                            <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-5 py-3">Status</th>
                            <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-5 py-3">Employees</th>
                            <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-5 py-3">Created</th>
                            <th className="w-12 px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? [...Array(5)].map((_, i) => (
                                <tr key={i} className="border-b border-white/[0.03]">
                                    {[...Array(6)].map((_, j) => (
                                        <td key={j} className="px-5 py-4">
                                            <div className="h-4 rounded bg-white/[0.04] animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                            : tenants.map((tenant) => {
                                const status = STATUS_CONFIG[tenant.status] || STATUS_CONFIG.active;
                                return (
                                    <tr
                                        key={tenant.id}
                                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                        onClick={() => router.push(`/platform/tenants/${tenant.id}`)}
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 flex-shrink-0">
                                                    {tenant.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                                                        {tenant.name}
                                                    </p>
                                                    <p className="text-xs text-zinc-600 font-mono">{tenant.slug}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm text-zinc-300">
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
                                            <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                                                <Users className="w-3.5 h-3.5 text-zinc-600" />
                                                <span className="tabular-nums">{tenant._count?.employees || 0}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-zinc-500 tabular-nums">
                                            {new Date(tenant.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); router.push(`/platform/tenants/${tenant.id}`); }}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
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
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                        <Building2 className="w-10 h-10 mb-3" />
                        <p className="text-sm font-medium">No tenants found</p>
                        <p className="text-xs mt-1">
                            {search ? "Try adjusting your search" : "Provision your first tenant to get started"}
                        </p>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
                        <span className="text-xs text-zinc-600">
                            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                                className="w-8 h-8 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs text-zinc-400 tabular-nums px-2">
                                {page} / {totalPages}
                            </span>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                                className="w-8 h-8 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-all"
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
