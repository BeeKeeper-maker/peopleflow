"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
    Receipt,
    Plus,
    Clock,
    CheckCircle2,
    XCircle,
    DollarSign,
    Calendar,
    Eye,
    Trash2,
    FileText,
    Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface ExpenseClaim {
    id: string;
    claimNumber: string;
    title: string;
    category: string | { name?: string };
    amount: number;
    date: string;
    expenseDate?: string;
    status: "draft" | "submitted" | "pending" | "approved" | "rejected" | "reimbursed";
    description?: string;
    receiptUrl?: string;
    createdAt: string;
}

interface ExpenseStats {
    pending: number;
    approved: number;
    reimbursed: number;
    totalReimbursed: number;
}

export default function ESSExpensesPage() {
    const t = useTranslations("ESSExpenses");
    const [isLoading, setIsLoading] = useState(true);
    const [claims, setClaims] = useState<ExpenseClaim[]>([]);
    const [stats, setStats] = useState<ExpenseStats>({
        pending: 0,
        approved: 0,
        reimbursed: 0,
        totalReimbursed: 0,
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/expenses/claims");
                if (res.ok) {
                    const data = await res.json();
                    const expenseClaims = Array.isArray(data) ? data : data.data || data.claims || [];
                    setClaims(expenseClaims);

                    // Calculate stats
                    const pendingCount = expenseClaims.filter((c: ExpenseClaim) => c.status === "submitted" || c.status === "pending").length;
                    const approvedCount = expenseClaims.filter((c: ExpenseClaim) => c.status === "approved").length;
                    const reimbursedCount = expenseClaims.filter((c: ExpenseClaim) => c.status === "reimbursed").length;
                    const totalReimbursedAmount = expenseClaims
                        .filter((c: ExpenseClaim) => c.status === "reimbursed")
                        .reduce((sum: number, c: ExpenseClaim) => sum + c.amount, 0);

                    setStats({
                        pending: pendingCount,
                        approved: approvedCount,
                        reimbursed: reimbursedCount,
                        totalReimbursed: totalReimbursedAmount,
                    });
                }
            } catch (error) {
                console.error("Error fetching expenses:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "draft":
                return (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                        <FileText className="h-3 w-3 mr-1" />
                        {t("draft")}
                    </Badge>
                );
            case "pending":
            case "submitted":
                return (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        {t("pending")}
                    </Badge>
                );
            case "approved":
                return (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t("approved")}
                    </Badge>
                );
            case "rejected":
                return (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        {t("rejected")}
                    </Badge>
                );
            case "reimbursed":
                return (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {t("reimbursed")}
                    </Badge>
                );
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
                </div>
                <Link href="/ess/expenses/new">
                    <Button className="bg-blue-600 hover:bg-blue-500">
                        <Plus className="h-4 w-4 mr-2" />
                        {t("newExpenseClaim")}
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                                <p className="text-xs text-muted-foreground">{t("pendingStat")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.approved}</p>
                                <p className="text-xs text-muted-foreground">{t("approvedStat")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <DollarSign className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.reimbursed}</p>
                                <p className="text-xs text-muted-foreground">{t("reimbursedStat")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Receipt className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-foreground">{formatCurrency(stats.totalReimbursed)}</p>
                                <p className="text-xs text-muted-foreground">{t("totalReimbursed")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Claims List */}
            <Card className="bg-card border-card-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-blue-400" />
                        {t("expenseClaims")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {claims.length === 0 ? (
                        <div className="p-8 text-center">
                            <Receipt className="h-12 w-12 text-muted-text mx-auto mb-4" />
                            <p className="text-muted-foreground mb-4">{t("noClaimsYet")}</p>
                            <Link href="/ess/expenses/new">
                                <Button className="bg-blue-600 hover:bg-blue-500">
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t("createFirstClaim")}
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-card-border">
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("claimNo")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("titleCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("categoryCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("dateCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("amountCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("statusCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("actionsCol")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claims.map((claim) => (
                                        <tr
                                            key={claim.id}
                                            className="border-b border-card-border hover:bg-hover"
                                        >
                                            <td className="px-4 py-3 text-sm text-tertiary-foreground">
                                                {claim.claimNumber}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {claim.title}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                                {typeof claim.category === "string" ? claim.category : claim.category?.name || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                                {new Date(claim.expenseDate || claim.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-foreground">
                                                {formatCurrency(claim.amount)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(claim.status)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <Button size="sm" variant="ghost" className="text-blue-400 h-8 w-8 p-0">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
