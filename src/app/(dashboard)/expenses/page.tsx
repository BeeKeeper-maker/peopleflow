"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import {
    Receipt,
    Plus,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    Clock,
    Banknote,
    TrendingUp,
    AlertCircle,
    ChevronDown,
    Eye,
    Loader2,
    Calendar,
    DollarSign,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

interface ExpenseClaim {
    id: string;
    amount: number;
    amountInBDT?: number;
    currency?: string;
    title?: string;
    description: string;
    category: string | { name?: string };
    status: "submitted" | "pending" | "approved" | "rejected" | "reimbursed" | "draft";
    date?: string;
    expenseDate?: string;
    createdAt: string;
    receiptUrl?: string;
    notes?: string;
    policyViolation?: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
        department?: { name: string };
    };
}

interface ExpenseStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    totalAmount: number;
    pendingAmount: number;
}

// ════════════════════════════════════════════════════════════════════════
// Status Config (colors + icons only — labels are i18n in component)
// ════════════════════════════════════════════════════════════════════════

const statusColors = {
    draft: { color: "bg-slate-500/20 text-slate-400", icon: Receipt },
    pending: { color: "bg-amber-500/20 text-amber-400", icon: Clock },
    approved: { color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle2 },
    rejected: { color: "bg-red-500/20 text-red-400", icon: XCircle },
    reimbursed: { color: "bg-blue-500/20 text-blue-400", icon: Banknote },
};

// ════════════════════════════════════════════════════════════════════════
// Expense Claims Page
// ════════════════════════════════════════════════════════════════════════

export default function ExpensesPage() {
    const { addToast } = useToast();
    const t = useTranslations('Expenses');

    const statusConfig: Record<string, { label: string; color: string; icon: typeof Receipt }> = {
        draft: { label: t("statusDraft"), color: statusColors.draft.color, icon: statusColors.draft.icon },
        pending: { label: t("statusPending"), color: statusColors.pending.color, icon: statusColors.pending.icon },
        approved: { label: t("statusApproved"), color: statusColors.approved.color, icon: statusColors.approved.icon },
        rejected: { label: t("statusRejected"), color: statusColors.rejected.color, icon: statusColors.rejected.icon },
        reimbursed: { label: t("statusReimbursed"), color: statusColors.reimbursed.color, icon: statusColors.reimbursed.icon },
    };

    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<ExpenseClaim[]>([]);
    const [stats, setStats] = useState<ExpenseStats | null>(null);
    const [filter, setFilter] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchClaims();
    }, []);

    const fetchClaims = async () => {
        try {
            const res = await fetch("/api/expenses/claims");
            if (res.ok) {
                const data = await res.json();
                const allClaims = Array.isArray(data) ? data : data.data || data.claims || [];
                setClaims(allClaims);

                // Calculate stats from data
                setStats({
                    total: allClaims.length,
                    pending: allClaims.filter((c: ExpenseClaim) => c.status === "submitted" || c.status === "pending").length,
                    approved: allClaims.filter((c: ExpenseClaim) => c.status === "approved").length,
                    rejected: allClaims.filter((c: ExpenseClaim) => c.status === "rejected").length,
                    totalAmount: allClaims.reduce((s: number, c: ExpenseClaim) => s + c.amount, 0),
                    pendingAmount: allClaims.filter((c: ExpenseClaim) => c.status === "submitted" || c.status === "pending").reduce((s: number, c: ExpenseClaim) => s + c.amount, 0),
                });
            }
        } catch (error) {
            console.error("Failed to fetch claims:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (claimId: string, action: "approve" | "reject" | "reimburse") => {
        setProcessing(claimId);
        try {
            const res = await fetch(`/api/expenses/claims/${claimId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });

            if (res.ok) {
                addToast({ title: t("claimActiond", { action }), description: t("claimActiondDesc", { action }), type: "success" });
                fetchClaims();
            } else {
                const err = await res.json();
                addToast({ title: "Error", description: err.error || `Failed to ${action}`, type: "error" });
            }
        } catch {
            addToast({ title: "Error", description: "Network error", type: "error" });
        } finally {
            setProcessing(null);
        }
    };

    const filteredClaims = claims
        .filter(c => filter === "all" || c.status === filter || (filter === "pending" && c.status === "submitted"))
        .filter(c => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                c.employee.firstName.toLowerCase().includes(q) ||
                c.employee.lastName.toLowerCase().includes(q) ||
                (c.description || "").toLowerCase().includes(q) ||
                (typeof c.category === "string" ? c.category : c.category?.name || "").toLowerCase().includes(q)
            );
        });

    const formatCurrency = (amount: number) => `৳${amount.toLocaleString()}`;

    const statCards = stats ? [
        { label: "Total Claims", value: stats.total, icon: Receipt, color: "from-blue-500 to-blue-600", glow: "icon-glow-blue" },
        { label: "Pending", value: stats.pending, icon: Clock, color: "from-amber-500 to-amber-600", glow: "icon-glow-orange", sub: formatCurrency(stats.pendingAmount) },
        { label: "Approved", value: stats.approved, icon: CheckCircle2, color: "from-emerald-500 to-emerald-600", glow: "icon-glow-green" },
        { label: "Total Amount", value: formatCurrency(stats.totalAmount), icon: Banknote, color: "from-purple-500 to-purple-600", glow: "icon-glow-blue" },
    ] : [];

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t('title')}</h1>
                        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                    </div>
                    <Link href="/expenses/new">
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" /> {t('newClaim')}
                        </Button>
                    </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-20" />
                                            <Skeleton className="h-8 w-12" />
                                        </div>
                                        <Skeleton className="h-12 w-12 rounded-xl" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        statCards.map((s, i) => (
                            <Card key={i}>
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground">{s.label}</p>
                                            <p className="text-3xl font-display font-bold text-foreground mt-2">{s.value}</p>
                                            {s.sub && <p className="text-xs text-amber-400 mt-1">{s.sub}</p>}
                                        </div>
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${s.color} shadow-lg ${s.glow}`}>
                                            <s.icon className="h-6 w-6 text-foreground" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Filters + Search */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('searchPlaceholder')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="flex gap-2">
                                {["all", "pending", "approved", "rejected"].map(f => (
                                    <Button
                                        key={f}
                                        variant={filter === f ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setFilter(f)}
                                        className="capitalize"
                                    >
                                        {f}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Claims List */}
                <div className="space-y-3">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="h-3 w-60" />
                                        </div>
                                        <Skeleton className="h-8 w-20" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : filteredClaims.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <Receipt className="h-12 w-12 text-tertiary-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">No expense claims found</p>
                            </CardContent>
                        </Card>
                    ) : (
                        filteredClaims.map((claim) => {
                            const config = statusConfig[claim.status === "submitted" ? "pending" : claim.status as keyof typeof statusConfig];
                            const StatusIcon = config.icon;
                            return (
                                <Card key={claim.id} className="hover:border-border transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                            {/* Employee Info */}
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <Avatar className="h-10 w-10 shrink-0">
                                                    <AvatarFallback className="text-xs">
                                                        {claim.employee.firstName[0]}{claim.employee.lastName[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {claim.employee.firstName} {claim.employee.lastName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {claim.employee.department?.name || "—"} • {claim.employee.employeeCode}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-foreground truncate">{claim.description}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="default" className="text-[10px]">{typeof claim.category === "string" ? claim.category : claim.category?.name || "—"}</Badge>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(claim.expenseDate || claim.date || claim.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Amount + Status */}
                                            <div className="flex items-center gap-4 shrink-0">
                                                <div className="text-right">
                                                    <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(claim.amountInBDT || claim.amount)}</p>
                                                    {claim.currency && claim.currency !== "BDT" && (
                                                        <p className="text-[10px] text-muted-foreground">{claim.currency} {claim.amount} → ৳{claim.amountInBDT}</p>
                                                    )}
                                                    <Badge className={`${config.color} text-[10px] mt-1`}>
                                                        <StatusIcon className="h-3 w-3 mr-1" />
                                                        {config.label}
                                                    </Badge>
                                                </div>

                                                {/* Actions — show for "submitted" (the actual API status) and legacy "pending" */}
                                                {(claim.status === "pending" || claim.status === "submitted") && (
                                                    <div className="flex gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                                            onClick={() => handleAction(claim.id, "approve")}
                                                            disabled={processing === claim.id}
                                                        >
                                                            {processing === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                            onClick={() => handleAction(claim.id, "reject")}
                                                            disabled={processing === claim.id}
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                                {/* Reimburse action for approved claims */}
                                                {claim.status === "approved" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 px-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                                        onClick={() => handleAction(claim.id, "reimburse")}
                                                        disabled={processing === claim.id}
                                                    >
                                                        {processing === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4 mr-1" />}
                                                        Reimburse
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
}
