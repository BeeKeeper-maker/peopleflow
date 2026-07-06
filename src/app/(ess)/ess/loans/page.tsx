"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import {
    Banknote,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    ArrowUpDown,
    TrendingUp,
    Wallet,
    Calendar,
    ChevronDown,
    ChevronUp,
    Receipt,
    CreditCard,
} from "lucide-react";

interface LoanRepayment {
    id: string;
    installmentNo: number;
    amount: number;
    principalPart: number;
    interestPart: number;
    paidDate: string;
    method: string;
}

interface Loan {
    id: string;
    type: string;
    amount: number;
    interestRate: number;
    tenure: number;
    emiAmount: number;
    disbursedAmount: number;
    paidAmount: number;
    remainingAmount: number;
    reason?: string;
    status: string;
    approvedAt?: string;
    disbursedAt?: string;
    createdAt: string;
    approver?: { firstName: string; lastName: string } | null;
    repayments: LoanRepayment[];
}

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    pending: { color: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: Clock },
    approved: { color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: CheckCircle2 },
    rejected: { color: "bg-red-500/15 text-red-400 border-red-500/20", icon: XCircle },
    disbursed: { color: "bg-purple-500/15 text-purple-400 border-purple-500/20", icon: ArrowUpDown },
    closed: { color: "bg-green-500/15 text-green-400 border-green-500/20", icon: CheckCircle2 },
};

const loanTypeKeys: Record<string, string> = {
    salary_advance: "salaryAdvance",
    emergency: "emergency",
    personal: "personal",
    home: "home",
    education: "education",
    vehicle: "vehicle",
};

const methodLabels: Record<string, string> = {
    payroll: "Payroll",
    bank_transfer: "Bank Transfer",
    cash: "Cash",
};

export default function ESSLoansPage() {
    const { addToast } = useToast();
    const t = useTranslations("ESSLoans");
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedLoanIds, setExpandedLoanIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchLoans = async () => {
            try {
                const res = await fetch("/api/loans");
                if (res.ok) {
                    const data = await res.json();
                    const myLoans = Array.isArray(data) ? data : (data.loans || []);
                    setLoans(myLoans);
                }
            } catch (err) {
                console.error("Failed to fetch loans:", err);
                addToast({ title: "Failed to load data. Please refresh the page.", type: "error" });
            } finally {
                setLoading(false);
            }
        };

        fetchLoans();
    }, []);

    const toggleRepayments = (id: string) => {
        setExpandedLoanIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const totalOutstanding = loans.reduce((sum, l) => sum + (l.remainingAmount || 0), 0);
    const totalRepaid = loans.reduce((sum, l) => sum + (l.paidAmount || 0), 0);
    const activeLoans = loans.filter(l => ["approved", "disbursed"].includes(l.status)).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t("title")}</h1>
                <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-500/10">
                                <Banknote className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{t("totalRepaid")}</p>
                                <p className="text-lg font-display font-bold tabular-nums text-foreground">৳{totalRepaid.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-500/10">
                                <Wallet className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{t("outstanding")}</p>
                                <p className="text-lg font-display font-bold tabular-nums text-foreground">৳{totalOutstanding.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-green-500/10">
                                <TrendingUp className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{t("activeLoans")}</p>
                                <p className="text-lg font-display font-bold tabular-nums text-foreground">{activeLoans}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Loans list */}
            {loans.length === 0 ? (
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="py-16 text-center">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                            <Banknote className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">{t("noLoans")}</h3>
                        <p className="text-muted-foreground text-sm">{t("noLoansDesc")}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {loans.map((loan) => {
                        const config = statusConfig[loan.status] || statusConfig.pending;
                        const StatusIcon = config.icon;
                        const translationKey = loanTypeKeys[loan.type];
                        const isExpanded = expandedLoanIds.has(loan.id);
                        const hasRepayments = loan.repayments && loan.repayments.length > 0;

                        return (
                            <Card key={loan.id} className="bg-card-bg border-card-border hover:border-primary/20 transition-colors">
                                <CardContent className="p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                                                <Banknote className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-foreground">
                                                    {translationKey ? t(translationKey as any) : loan.type}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Wallet className="h-3.5 w-3.5" />
                                                        ৳{loan.amount.toLocaleString()}
                                                    </span>
                                                    {loan.tenure && (
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            {loan.tenure} {t("tenure")}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {t("appliedOn")} {new Date(loan.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {loan.reason && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {t("purpose")}: {loan.reason}
                                                    </p>
                                                )}
                                                {loan.approver && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {t("approvedBy")}: {loan.approver.firstName} {loan.approver.lastName}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {loan.emiAmount > 0 && (
                                                <div className="text-right mr-2 hidden sm:block">
                                                    <p className="text-xs text-muted-foreground">{t("monthlyInstallment")}</p>
                                                    <p className="text-sm font-semibold tabular-nums text-foreground">৳{loan.emiAmount.toLocaleString()}</p>
                                                </div>
                                            )}
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border",
                                                config.color
                                            )}>
                                                <StatusIcon className="h-3.5 w-3.5" />
                                                {t(loan.status as any)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress bar for disbursed loans */}
                                    {loan.status === "disbursed" && loan.amount > 0 && (
                                        <div className="mt-4 pt-4 border-t border-card-border">
                                            <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                                <span>{t("totalRepaid")}: ৳{loan.paidAmount.toLocaleString()}</span>
                                                <span>{t("outstanding")}: ৳{(loan.remainingAmount || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-linear-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                                                    style={{ width: `${Math.min(100, (loan.paidAmount / loan.amount) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Repayment Schedule — backed by LoanRepayment model */}
                                    {hasRepayments && (
                                        <div className="mt-4 pt-4 border-t border-card-border">
                                            <button
                                                onClick={() => toggleRepayments(loan.id)}
                                                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                            >
                                                <Receipt className="h-4 w-4" />
                                                {t("repaymentSchedule")} ({loan.repayments.length}/{loan.tenure})
                                                {isExpanded
                                                    ? <ChevronUp className="h-4 w-4" />
                                                    : <ChevronDown className="h-4 w-4" />
                                                }
                                            </button>

                                            {isExpanded && (
                                                <div className="mt-3 overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="text-muted-foreground border-b border-card-border">
                                                                <th className="text-left py-2 pr-4">#</th>
                                                                <th className="text-left py-2 pr-4">{t("paidDate")}</th>
                                                                <th className="text-right py-2 pr-4">{t("amount")}</th>
                                                                <th className="text-right py-2 pr-4">{t("principal")}</th>
                                                                <th className="text-right py-2 pr-4">{t("interest")}</th>
                                                                <th className="text-left py-2">{t("method")}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {loan.repayments.map(rep => (
                                                                <tr key={rep.id} className="border-b border-card-border/50 text-foreground">
                                                                    <td className="py-2 pr-4">{rep.installmentNo}</td>
                                                                    <td className="py-2 pr-4">{new Date(rep.paidDate).toLocaleDateString()}</td>
                                                                    <td className="py-2 pr-4 text-right font-medium">৳{rep.amount.toLocaleString()}</td>
                                                                    <td className="py-2 pr-4 text-right">৳{rep.principalPart.toLocaleString()}</td>
                                                                    <td className="py-2 pr-4 text-right">৳{rep.interestPart.toLocaleString()}</td>
                                                                    <td className="py-2 flex items-center gap-1">
                                                                        <CreditCard className="h-3 w-3 text-muted-foreground" />
                                                                        {methodLabels[rep.method] || rep.method}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
