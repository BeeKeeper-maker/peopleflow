"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    description?: string;
    amount: number;
    expenseDate: string;
    status: "draft" | "submitted" | "approved" | "rejected" | "reimbursed" | "cancelled";
    submittedAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
    reimbursedAt?: string;
    approverNotes?: string;
    category: {
        id: string;
        name: string;
        color?: string;
    };
}

export default function ESSExpensesPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [claims, setClaims] = useState<ExpenseClaim[]>([]);
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        reimbursed: 0,
        totalAmount: 0,
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/api/expenses/claims");
                if (response.ok) {
                    const data = await response.json();
                    setClaims(data);

                    // Calculate stats
                    setStats({
                        pending: data.filter((c: ExpenseClaim) => c.status === "submitted").length,
                        approved: data.filter((c: ExpenseClaim) => c.status === "approved").length,
                        reimbursed: data.filter((c: ExpenseClaim) => c.status === "reimbursed").length,
                        totalAmount: data
                            .filter((c: ExpenseClaim) => c.status === "reimbursed")
                            .reduce((acc: number, c: ExpenseClaim) => acc + c.amount, 0),
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
                        Draft
                    </Badge>
                );
            case "submitted":
                return (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                    </Badge>
                );
            case "approved":
                return (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Approved
                    </Badge>
                );
            case "rejected":
                return (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        Rejected
                    </Badge>
                );
            case "reimbursed":
                return (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        <DollarSign className="h-3 w-3 mr-1" />
                        Reimbursed
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">My Expenses</h1>
                    <p className="text-white/60 mt-1">
                        Track and submit expense claims
                    </p>
                </div>
                <Link href="/ess/expenses/new">
                    <Button className="bg-blue-600 hover:bg-blue-500">
                        <Plus className="h-4 w-4 mr-2" />
                        New Expense Claim
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stats.pending}</p>
                                <p className="text-xs text-white/60">Pending</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stats.approved}</p>
                                <p className="text-xs text-white/60">Approved</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <DollarSign className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stats.reimbursed}</p>
                                <p className="text-xs text-white/60">Reimbursed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Receipt className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-white">{formatCurrency(stats.totalAmount)}</p>
                                <p className="text-xs text-white/60">Total Reimbursed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Claims List */}
            <Card className="bg-[#141419] border-white/5">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-blue-400" />
                        Expense Claims
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {claims.length === 0 ? (
                        <div className="p-8 text-center">
                            <Receipt className="h-12 w-12 text-white/20 mx-auto mb-4" />
                            <p className="text-white/60 mb-4">No expense claims yet</p>
                            <Link href="/ess/expenses/new">
                                <Button className="bg-blue-600 hover:bg-blue-500">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Your First Claim
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Claim #</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Title</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Category</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Date</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-white/60">Amount</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Status</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-white/60">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claims.map((claim) => (
                                        <tr
                                            key={claim.id}
                                            className="border-b border-white/5 hover:bg-white/5"
                                        >
                                            <td className="px-4 py-3 text-sm text-white font-mono">
                                                {claim.claimNumber}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-white">{claim.title}</p>
                                                {claim.description && (
                                                    <p className="text-xs text-white/40 truncate max-w-[200px]">
                                                        {claim.description}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    className="text-xs"
                                                    style={{
                                                        backgroundColor: `${claim.category.color}20` || "#ffffff20",
                                                        color: claim.category.color || "#ffffff",
                                                        borderColor: `${claim.category.color}30` || "#ffffff30",
                                                    }}
                                                >
                                                    {claim.category.name}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-white/60">
                                                {new Date(claim.expenseDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-white font-medium text-right">
                                                {formatCurrency(claim.amount)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(claim.status)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    {claim.status === "draft" && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300"
                                                        >
                                                            <Send className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-white/60 hover:text-white"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {(claim.status === "draft" || claim.status === "rejected") && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
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
