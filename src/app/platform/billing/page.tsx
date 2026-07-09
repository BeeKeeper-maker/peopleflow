"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
    DollarSign,
    TrendingUp,
    Clock,
    AlertCircle,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Search,
    Filter,
    Download,
    Receipt,
    Building2,
    ChevronLeft,
    ChevronRight,
    Loader2,
} from "lucide-react";
import { MetricCard } from "@/components/platform/metric-card";

interface Invoice {
    id: string;
    invoiceNumber: string;
    status: string;
    amountBDT: number;
    amountRaw: number;
    currency: string;
    description: string | null;
    paidAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
    paymentMethod: string | null;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    createdAt: string;
    subscription: {
        id: string;
        status: string;
        billingCycle: string;
        organization: { id: string; name: string; slug: string };
        plan: { id: string; name: string; slug: string; priceMonthly: number; priceYearly: number };
    };
}

interface Metrics {
    totalRevenueBDT: number;
    totalInvoicesPaid: number;
    pendingRevenueBDT: number;
    pendingInvoices: number;
    failedRevenueBDT: number;
    failedInvoices: number;
    refundedRevenueBDT: number;
    refundedInvoices: number;
    revenueThisMonthBDT: number;
    revenueLastMonthBDT: number;
    revenueGrowthPercent: number;
    failedPayments: number;
    pastDueTenants: number;
}

interface BillingResponse {
    invoices: Invoice[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
    metrics: Metrics;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    paid: { label: "Paid", color: "text-emerald-400 bg-emerald-500/10", icon: CheckCircle2 },
    pending: { label: "Pending", color: "text-amber-400 bg-amber-500/10", icon: Clock },
    failed: { label: "Failed", color: "text-red-400 bg-red-500/10", icon: XCircle },
    refunded: { label: "Refunded", color: "text-blue-400 bg-blue-500/10", icon: RefreshCw },
    void: { label: "Void", color: "text-muted-foreground bg-zinc-500/10", icon: XCircle },
};

const STATUS_FILTERS = [
    { value: "all", label: "All" },
    { value: "paid", label: "Paid" },
    { value: "pending", label: "Pending" },
    { value: "failed", label: "Failed" },
    { value: "refunded", label: "Refunded" },
] as const;

function formatBDT(amount: number): string {
    return `৳${amount.toLocaleString("en-BD", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function PlatformBillingPage() {
    const t = useTranslations("Platform");
    const [data, setData] = useState<BillingResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");

    const fetchBilling = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("limit", "25");
            if (statusFilter !== "all") params.set("status", statusFilter);
            if (search) params.set("search", search);

            const res = await fetch(`/api/platform/billing?${params.toString()}`, {
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to load billing data");
            }
            setData(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, search]);

    useEffect(() => {
        fetchBilling();
    }, [fetchBilling]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
    };

    const handleStatusFilter = (value: string) => {
        setPage(1);
        setStatusFilter(value);
    };

    const metrics = data?.metrics;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                        <DollarSign className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground">{t("billing")}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {t("billingSubtitle")}
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchBilling}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-hover text-sm text-foreground hover:text-foreground hover:bg-hover transition-colors"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {t("refresh")}
                </button>
            </div>

            {/* Metric Cards */}
            {metrics && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title={t("totalRevenue")}
                        value={formatBDT(metrics.totalRevenueBDT)}
                        icon={DollarSign}
                        color="emerald"
                    />
                    <MetricCard
                        title={t("revenue30d")}
                        value={formatBDT(metrics.revenueThisMonthBDT)}
                        change={metrics.revenueGrowthPercent}
                        changeLabel="vs last 30d"
                        icon={TrendingUp}
                        color="indigo"
                    />
                    <MetricCard
                        title={t("pendingRevenue")}
                        value={formatBDT(metrics.pendingRevenueBDT)}
                        icon={Clock}
                        color="amber"
                    />
                    <MetricCard
                        title={t("failedPayments")}
                        value={metrics.failedPayments}
                        icon={AlertCircle}
                        color="rose"
                    />
                </div>
            )}

            {/* Filters Bar */}
            <div className="rounded-xl border border-border bg-hover/50 p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <form onSubmit={handleSearchSubmit} className="relative flex-1 lg:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search invoice # or tenant name..."
                        className="w-full h-9 pl-10 pr-3 rounded-lg bg-hover border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50"
                    />
                </form>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Filter className="h-3.5 w-3.5" />
                        Status
                    </span>
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => handleStatusFilter(f.value)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                statusFilter === f.value
                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                    : "bg-hover text-muted-foreground border border-border hover:text-foreground hover:bg-hover"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="text-sm text-red-300 mb-2">{error}</p>
                    <button
                        onClick={fetchBilling}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors text-sm"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </button>
                </div>
            )}

            {/* Invoices Table */}
            {!error && (
                <div className="rounded-xl border border-border bg-hover/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                                    <th className="px-4 py-3 font-medium">Invoice</th>
                                    <th className="px-4 py-3 font-medium">Tenant</th>
                                    <th className="px-4 py-3 font-medium">Plan</th>
                                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                                    <th className="px-4 py-3 font-medium">Period</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Paid/Failed At</th>
                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {loading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <tr key={i}>
                                            {Array.from({ length: 8 }).map((_, j) => (
                                                <td key={j} className="px-4 py-3">
                                                    <div className="h-4 rounded bg-hover animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : !data?.invoices.length ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center">
                                            <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                                            <p className="text-sm text-muted-foreground">No invoices found</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {search || statusFilter !== "all"
                                                    ? "Try adjusting your filters."
                                                    : "Invoices will appear here once tenants subscribe to a paid plan."}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    data.invoices.map((inv) => {
                                        const statusCfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                                        const StatusIcon = statusCfg.icon;
                                        return (
                                            <tr key={inv.id} className="text-sm hover:bg-hover/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <span className="font-mono text-foreground">{inv.invoiceNumber}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">Created {formatDate(inv.createdAt)}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Link
                                                        href={`/platform/tenants/${inv.subscription.organization.id}`}
                                                        className="flex items-center gap-2 text-foreground hover:text-foreground"
                                                    >
                                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        <span className="font-medium truncate max-w-[160px]">
                                                            {inv.subscription.organization.name}
                                                        </span>
                                                    </Link>
                                                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                                                        {inv.subscription.billingCycle} billing
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-foreground">{inv.subscription.plan.name}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <p className="font-semibold text-foreground tabular-nums">
                                                        {formatBDT(inv.amountBDT)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">{inv.currency}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDate(inv.periodStart)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">→ {formatDate(inv.periodEnd)}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${statusCfg.color}`}>
                                                        <StatusIcon className="h-3 w-3" />
                                                        {statusCfg.label}
                                                    </span>
                                                    {inv.paymentMethod && (
                                                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                                                            via {inv.paymentMethod.replace("_", " ")}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {inv.paidAt ? (
                                                        <p className="text-xs text-emerald-400">{formatDateTime(inv.paidAt)}</p>
                                                    ) : inv.failedAt ? (
                                                        <div>
                                                            <p className="text-xs text-red-400">{formatDateTime(inv.failedAt)}</p>
                                                            {inv.failureReason && (
                                                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]" title={inv.failureReason}>
                                                                    {inv.failureReason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">
                                                            Due {formatDate(inv.dueDate)}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                                                        title="Download invoice (coming soon)"
                                                        disabled
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                        PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data && data.pagination.total > 0 && (
                        <div className="border-t border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
                            <p>
                                Showing <span className="text-foreground">{(data.pagination.page - 1) * data.pagination.limit + 1}</span>
                                {" "}-{" "}
                                <span className="text-foreground">
                                    {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}
                                </span>
                                {" "}of <span className="text-foreground">{data.pagination.total}</span> invoices
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1 || loading}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    Prev
                                </button>
                                <span className="px-2">
                                    Page <span className="text-foreground">{data.pagination.page}</span> / {data.pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setPage((p) => p + 1)}
                                    disabled={!data.pagination.hasMore || loading}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
