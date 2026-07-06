"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Clock,
    Loader2,
    MessageSquare,
    Receipt,
    RefreshCw,
    XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useLocale, useTranslations } from "next-intl";

type ApprovalType = "leave" | "expense";

interface LeaveApproval {
    id: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        photoUrl?: string | null;
        designation?: { name: string } | null;
    };
    leaveType: { name: string };
    fromDate: string;
    toDate: string;
    totalDays: number;
    reason: string | null;
    createdAt: string;
}

interface ExpenseApproval {
    id: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        photoUrl?: string | null;
        designation?: { name: string } | null;
    };
    title?: string | null;
    category: string | { name?: string | null } | null;
    amount: number;
    description: string | null;
    createdAt: string;
}

function approvalKey(type: ApprovalType, id: string) {
    return `${type}:${id}`;
}

export default function ManagerApprovalsPage() {
    const t = useTranslations("ManagerApprovals");
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [leaveApprovals, setLeaveApprovals] = useState<LeaveApproval[]>([]);
    const [expenseApprovals, setExpenseApprovals] = useState<ExpenseApproval[]>([]);
    const [processingKey, setProcessingKey] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
    const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

    const formatDate = useCallback((value: string) => (
        new Intl.DateTimeFormat(dateLocale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    ), [dateLocale]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [leavesRes, expensesRes] = await Promise.all([
                fetch("/api/leaves/applications?status=pending&limit=100"),
                fetch("/api/expenses/claims?pending=true"),
            ]);

            if (leavesRes.ok) {
                const data = await leavesRes.json();
                setLeaveApprovals(data.data || data || []);
            }

            if (expensesRes.ok) {
                const data = await expensesRes.json();
                setExpenseApprovals(Array.isArray(data) ? data : data.data || data.claims || []);
            }
        } catch (error) {
            console.error("Error fetching data:", error); addToast({ title: "Failed to load data. Please refresh.", type: "error" }); addToast({ title: "Failed to load data. Please refresh.", type: "error" });
            addToast({ title: t("errorOccurred"), type: "error" });
        } finally {
            setIsLoading(false);
        }
    }, [addToast, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleApprove = async (id: string, type: ApprovalType) => {
        const key = approvalKey(type, id);
        setProcessingKey(key);
        try {
            const endpoint = type === "leave" ? `/api/leaves/applications/${id}` : `/api/expenses/claims/${id}`;
            const res = await fetch(endpoint, {
                method: type === "leave" ? "PUT" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(type === "leave" ? { status: "approved" } : { action: "approve" }),
            });

            if (res.ok) {
                if (type === "leave") setLeaveApprovals((prev) => prev.filter((approval) => approval.id !== id));
                else setExpenseApprovals((prev) => prev.filter((approval) => approval.id !== id));
                addToast({ title: t("approveSuccess"), type: "success" });
            } else {
                const errorText = await res.text().catch(() => "");
                addToast({ title: errorText || t("approveFailed"), type: "error" });
            }
        } catch (error) {
            console.error("Error approving:", error);
            addToast({ title: t("errorOccurred"), type: "error" });
        } finally {
            setProcessingKey(null);
        }
    };

    const handleReject = async (id: string, type: ApprovalType) => {
        const key = approvalKey(type, id);
        const reason = rejectReason[key]?.trim();
        if (!reason) {
            setShowRejectInput(key);
            return;
        }

        setProcessingKey(key);
        try {
            const endpoint = type === "leave" ? `/api/leaves/applications/${id}` : `/api/expenses/claims/${id}`;
            const res = await fetch(endpoint, {
                method: type === "leave" ? "PUT" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(type === "leave"
                    ? { status: "rejected", managerComment: reason }
                    : { action: "reject", notes: reason }),
            });

            if (res.ok) {
                if (type === "leave") setLeaveApprovals((prev) => prev.filter((approval) => approval.id !== id));
                else setExpenseApprovals((prev) => prev.filter((approval) => approval.id !== id));
                addToast({ title: t("rejectSuccess"), type: "success" });
            } else {
                const errorText = await res.text().catch(() => "");
                addToast({ title: errorText || t("rejectFailed"), type: "error" });
            }
        } catch (error) {
            console.error("Error rejecting:", error);
            addToast({ title: t("errorOccurred"), type: "error" });
        } finally {
            setProcessingKey(null);
            setShowRejectInput(null);
            setRejectReason((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const totalPending = leaveApprovals.length + expenseApprovals.length;
    const oldestRequestDays = useMemo(() => {
        const dates = [...leaveApprovals.map((item) => item.createdAt), ...expenseApprovals.map((item) => item.createdAt)]
            .map((value) => new Date(value).getTime())
            .filter((value) => Number.isFinite(value));
        if (dates.length === 0) return 0;
        return Math.max(0, Math.floor((Date.now() - Math.min(...dates)) / 86_400_000));
    }, [expenseApprovals, leaveApprovals]);

    const renderRejectBox = (id: string, type: ApprovalType) => {
        const key = approvalKey(type, id);
        if (showRejectInput !== key) return null;

        return (
            <div className="mt-3 space-y-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <Textarea
                    placeholder={t("rejectPlaceholder")}
                    value={rejectReason[key] || ""}
                    onChange={(event) => setRejectReason((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="bg-hover border-card-border text-foreground min-h-24"
                />
                <div className="flex flex-wrap gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setShowRejectInput(null)} className="text-muted-foreground">{t("cancel")}</Button>
                    <Button size="sm" onClick={() => handleReject(id, type)} disabled={!rejectReason[key]?.trim() || processingKey === key} className="bg-red-600 hover:bg-red-500">
                        {processingKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : t("confirmReject")}
                    </Button>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-36" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">
                        {totalPending === 1 ? t("requestsSingular", { count: totalPending }) : t("requestsPlural", { count: totalPending })}
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData} className="gap-2 self-start md:self-auto">
                    <RefreshCw className="h-4 w-4" />
                    {t("refresh")}
                </Button>
            </div>

            <Card className="bg-linear-to-r from-emerald-500/10 via-card to-card border-emerald-500/20">
                <CardContent className="p-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                        <div className="flex items-center gap-2 font-semibold text-foreground"><CheckSquareIcon />{t("decisionPurposeTitle")}</div>
                        <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">{t("decisionPurposeDesc")}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-lg bg-hover p-3"><p className="text-xl font-display font-bold text-foreground">{leaveApprovals.length}</p><p className="text-xs text-muted-foreground">{t("leaves")}</p></div>
                        <div className="rounded-lg bg-hover p-3"><p className="text-xl font-display font-bold text-foreground">{expenseApprovals.length}</p><p className="text-xs text-muted-foreground">{t("expenses")}</p></div>
                        <div className="rounded-lg bg-hover p-3"><p className="text-xl font-display font-bold text-foreground">{oldestRequestDays}</p><p className="text-xs text-muted-foreground">{t("oldestDays")}</p></div>
                    </div>
                </CardContent>
            </Card>

            {totalPending > 0 && (
                <Card className="bg-card border-amber-500/30">
                    <CardContent className="p-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
                        <p className="text-sm text-muted-foreground leading-relaxed">{t("decisionGuardrail")}</p>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="leaves">
                <TabsList className="bg-card border border-card-border">
                    <TabsTrigger value="leaves" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"><Calendar className="h-4 w-4 mr-2" />{t("leavesTab", { count: leaveApprovals.length })}</TabsTrigger>
                    <TabsTrigger value="expenses" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"><Receipt className="h-4 w-4 mr-2" />{t("expensesTab", { count: expenseApprovals.length })}</TabsTrigger>
                </TabsList>

                <TabsContent value="leaves" className="mt-6">
                    {leaveApprovals.length === 0 ? (
                        <EmptyState title={t("allCaughtUp")} description={t("noPendingLeaves")} />
                    ) : (
                        <div className="space-y-4">
                            {leaveApprovals.map((approval) => (
                                <Card key={approval.id} className="bg-card border-card-border">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                                            <EmployeeBlock name={`${approval.employee.firstName} ${approval.employee.lastName}`} photoUrl={approval.employee.photoUrl} designation={approval.employee.designation?.name || t("noDesignation")} tone="blue" />
                                            <div className="flex-1 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{approval.leaveType.name}</Badge>
                                                    <span className="text-muted-foreground text-sm">{approval.totalDays} {approval.totalDays === 1 ? t("day") : t("days")}</span>
                                                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />{t("pending")}</Badge>
                                                </div>
                                                <p className="text-foreground">{formatDate(approval.fromDate)} — {formatDate(approval.toDate)}</p>
                                                <p className="text-muted-foreground text-sm"><MessageSquare className="h-4 w-4 inline mr-1" />{t("reason")}: {approval.reason || "—"}</p>
                                                <p className="text-tertiary-foreground text-xs">{t("appliedOn")} {formatDate(approval.createdAt)}</p>
                                                {renderRejectBox(approval.id, "leave")}
                                            </div>
                                            <DecisionActions id={approval.id} type="leave" processingKey={processingKey} onApprove={handleApprove} onReject={handleReject} showRejectInput={showRejectInput} rejectLabel={t("reject")} approveLabel={t("approve")} />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="expenses" className="mt-6">
                    {expenseApprovals.length === 0 ? (
                        <EmptyState title={t("allCaughtUp")} description={t("noPendingExpenses")} />
                    ) : (
                        <div className="space-y-4">
                            {expenseApprovals.map((approval) => {
                                const category = typeof approval.category === "string" ? approval.category : approval.category?.name || "—";
                                return (
                                    <Card key={approval.id} className="bg-card border-card-border">
                                        <CardContent className="p-6">
                                            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                                                <EmployeeBlock name={`${approval.employee.firstName} ${approval.employee.lastName}`} photoUrl={approval.employee.photoUrl} designation={approval.employee.designation?.name || t("noDesignation")} tone="green" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{category}</Badge>
                                                        <span className="text-2xl font-display font-bold tabular-nums text-foreground">{formatCurrency(approval.amount || 0)}</span>
                                                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />{t("pending")}</Badge>
                                                    </div>
                                                    {approval.title && <p className="text-foreground font-medium">{approval.title}</p>}
                                                    <p className="text-muted-foreground text-sm"><MessageSquare className="h-4 w-4 inline mr-1" />{approval.description || "—"}</p>
                                                    <p className="text-tertiary-foreground text-xs">{t("submittedOn")} {formatDate(approval.createdAt)}</p>
                                                    {renderRejectBox(approval.id, "expense")}
                                                </div>
                                                <DecisionActions id={approval.id} type="expense" processingKey={processingKey} onApprove={handleApprove} onReject={handleReject} showRejectInput={showRejectInput} rejectLabel={t("reject")} approveLabel={t("approve")} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function CheckSquareIcon() {
    return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <Card className="bg-card border-card-border">
            <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <p className="text-foreground font-medium">{title}</p>
                <p className="text-muted-foreground text-sm mt-1">{description}</p>
            </CardContent>
        </Card>
    );
}

function EmployeeBlock({ name, photoUrl, designation, tone }: { name: string; photoUrl?: string | null; designation: string; tone: "blue" | "green" }) {
    const gradient = tone === "blue" ? "from-blue-500 to-purple-600" : "from-green-500 to-emerald-600";
    return (
        <div className="flex items-center gap-4 min-w-[220px]">
            <Avatar className="h-12 w-12">
                <AvatarImage src={photoUrl || undefined} />
                <AvatarFallback className={`bg-linear-to-br ${gradient} text-white`}>{name.trim()[0] || "?"}</AvatarFallback>
            </Avatar>
            <div>
                <h3 className="font-medium text-foreground">{name}</h3>
                <p className="text-sm text-muted-foreground">{designation}</p>
            </div>
        </div>
    );
}

function DecisionActions({
    id,
    type,
    processingKey,
    showRejectInput,
    onApprove,
    onReject,
    rejectLabel,
    approveLabel,
}: {
    id: string;
    type: ApprovalType;
    processingKey: string | null;
    showRejectInput: string | null;
    onApprove: (id: string, type: ApprovalType) => Promise<void>;
    onReject: (id: string, type: ApprovalType) => Promise<void>;
    rejectLabel: string;
    approveLabel: string;
}) {
    const key = approvalKey(type, id);
    const isProcessing = processingKey === key;
    const isRejectOpen = showRejectInput === key;

    return (
        <div className="flex gap-2 lg:flex-col lg:min-w-[150px]">
            <Button size="sm" variant="outline" onClick={() => onReject(id, type)} disabled={isProcessing || isRejectOpen} className="border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                <XCircle className="h-4 w-4 mr-1" />{rejectLabel}
            </Button>
            <Button size="sm" onClick={() => onApprove(id, type)} disabled={isProcessing || isRejectOpen} className="bg-green-600 hover:bg-green-500">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" />{approveLabel}</>}
            </Button>
        </div>
    );
}
