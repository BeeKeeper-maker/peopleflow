"use client";

import { useEffect, useState } from "react";
import {
    CheckSquare,
    Calendar,
    Receipt,
    CheckCircle2,
    XCircle,
    Clock,
    MessageSquare,
    Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";

interface LeaveApproval {
    id: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        photoUrl?: string;
        designation?: { name: string };
    };
    leaveType: { name: string };
    fromDate: string;
    toDate: string;
    totalDays: number;
    reason: string;
    createdAt: string;
}

interface ExpenseApproval {
    id: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        photoUrl?: string;
        designation?: { name: string };
    };
    category: string;
    amount: number;
    description: string;
    createdAt: string;
}

export default function ManagerApprovalsPage() {
    const t = useTranslations("ManagerApprovals");
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [leaveApprovals, setLeaveApprovals] = useState<LeaveApproval[]>([]);
    const [expenseApprovals, setExpenseApprovals] = useState<ExpenseApproval[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
    const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const leavesRes = await fetch("/api/leaves/applications?status=pending");
                if (leavesRes.ok) {
                    const data = await leavesRes.json();
                    setLeaveApprovals(data.data || data || []);
                }

                const expensesRes = await fetch("/api/expenses?status=pending");
                if (expensesRes.ok) {
                    const data = await expensesRes.json();
                    setExpenseApprovals(data.data || data || []);
                }
            } catch (error) {
                console.error("Error fetching approvals:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleApprove = async (id: string, type: "leave" | "expense") => {
        setProcessingId(id);
        try {
            const endpoint = type === "leave"
                ? `/api/leaves/applications/${id}`
                : `/api/expenses/${id}`;

            const res = await fetch(endpoint, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "approved" }),
            });

            if (res.ok) {
                if (type === "leave") {
                    setLeaveApprovals((prev) => prev.filter((a) => a.id !== id));
                } else {
                    setExpenseApprovals((prev) => prev.filter((a) => a.id !== id));
                }
                addToast({ title: t("approveSuccess"), type: "success" });
            } else {
                addToast({ title: t("approveFailed"), type: "error" });
            }
        } catch (error) {
            console.error("Error approving:", error);
            addToast({ title: t("errorOccurred"), type: "error" });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string, type: "leave" | "expense") => {
        if (!rejectReason[id]) {
            setShowRejectInput(id);
            return;
        }

        setProcessingId(id);
        try {
            const endpoint = type === "leave"
                ? `/api/leaves/applications/${id}`
                : `/api/expenses/${id}`;

            const res = await fetch(endpoint, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: "rejected",
                    rejectionReason: rejectReason[id],
                }),
            });

            if (res.ok) {
                if (type === "leave") {
                    setLeaveApprovals((prev) => prev.filter((a) => a.id !== id));
                } else {
                    setExpenseApprovals((prev) => prev.filter((a) => a.id !== id));
                }
                addToast({ title: t("rejectSuccess"), type: "success" });
            } else {
                addToast({ title: t("rejectFailed"), type: "error" });
            }
        } catch (error) {
            console.error("Error rejecting:", error);
            addToast({ title: t("errorOccurred"), type: "error" });
        } finally {
            setProcessingId(null);
            setShowRejectInput(null);
            setRejectReason((prev) => {
                const newReasons = { ...prev };
                delete newReasons[id];
                return newReasons;
            });
        }
    };

    const totalPending = leaveApprovals.length + expenseApprovals.length;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
                <p className="text-muted-foreground mt-1">
                    {totalPending === 1
                        ? t("requestsSingular", { count: totalPending })
                        : t("requestsPlural", { count: totalPending })}
                </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="leaves">
                <TabsList className="bg-card border border-card-border">
                    <TabsTrigger
                        value="leaves"
                        className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
                    >
                        <Calendar className="h-4 w-4 mr-2" />
                        {t("leavesTab", { count: leaveApprovals.length })}
                    </TabsTrigger>
                    <TabsTrigger
                        value="expenses"
                        className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
                    >
                        <Receipt className="h-4 w-4 mr-2" />
                        {t("expensesTab", { count: expenseApprovals.length })}
                    </TabsTrigger>
                </TabsList>

                {/* Leave Approvals */}
                <TabsContent value="leaves" className="mt-6">
                    {leaveApprovals.length === 0 ? (
                        <Card className="bg-card border-card-border">
                            <CardContent className="py-12 text-center">
                                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                                <p className="text-foreground font-medium">{t("allCaughtUp")}</p>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {t("noPendingLeaves")}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {leaveApprovals.map((approval) => (
                                <Card key={approval.id} className="bg-card border-card-border">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                            {/* Employee Info */}
                                            <div className="flex items-center gap-4 min-w-[200px]">
                                                <Avatar className="h-12 w-12">
                                                    <AvatarImage src={approval.employee.photoUrl} />
                                                    <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-foreground">
                                                        {approval.employee.firstName[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="font-medium text-foreground">
                                                        {approval.employee.firstName} {approval.employee.lastName}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        {approval.employee.designation?.name || t("noDesignation")}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Leave Details */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                                        {approval.leaveType.name}
                                                    </Badge>
                                                    <span className="text-muted-foreground text-sm">
                                                        {approval.totalDays} {approval.totalDays === 1 ? t("day") : t("days")}
                                                    </span>
                                                </div>
                                                <p className="text-foreground">
                                                    {new Date(approval.fromDate).toLocaleDateString()} -{" "}
                                                    {new Date(approval.toDate).toLocaleDateString()}
                                                </p>
                                                <p className="text-muted-foreground text-sm mt-1">
                                                    {t("reason")}: {approval.reason}
                                                </p>
                                                <p className="text-tertiary-foreground text-xs mt-2">
                                                    {t("appliedOn")} {new Date(approval.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-2">
                                                {showRejectInput === approval.id ? (
                                                    <div className="space-y-2">
                                                        <Textarea
                                                            placeholder={t("rejectPlaceholder")}
                                                            value={rejectReason[approval.id] || ""}
                                                            onChange={(e) =>
                                                                setRejectReason((prev) => ({
                                                                    ...prev,
                                                                    [approval.id]: e.target.value,
                                                                }))
                                                            }
                                                            className="bg-hover border-card-border text-foreground min-w-[200px]"
                                                        />
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setShowRejectInput(null)}
                                                                className="text-muted-foreground"
                                                            >
                                                                {t("cancel")}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleReject(approval.id, "leave")}
                                                                disabled={!rejectReason[approval.id]}
                                                                className="bg-red-600 hover:bg-red-500"
                                                            >
                                                                {processingId === approval.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    t("confirmReject")
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleReject(approval.id, "leave")}
                                                            disabled={processingId === approval.id}
                                                            className="border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                        >
                                                            <XCircle className="h-4 w-4 mr-1" />
                                                            {t("reject")}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleApprove(approval.id, "leave")}
                                                            disabled={processingId === approval.id}
                                                            className="bg-green-600 hover:bg-green-500"
                                                        >
                                                            {processingId === approval.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                                    {t("approve")}
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Expense Approvals */}
                <TabsContent value="expenses" className="mt-6">
                    {expenseApprovals.length === 0 ? (
                        <Card className="bg-card border-card-border">
                            <CardContent className="py-12 text-center">
                                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                                <p className="text-foreground font-medium">{t("allCaughtUp")}</p>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {t("noPendingExpenses")}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {expenseApprovals.map((approval) => (
                                <Card key={approval.id} className="bg-card border-card-border">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                            {/* Employee Info */}
                                            <div className="flex items-center gap-4 min-w-[200px]">
                                                <Avatar className="h-12 w-12">
                                                    <AvatarImage src={approval.employee.photoUrl} />
                                                    <AvatarFallback className="bg-linear-to-br from-green-500 to-emerald-600 text-foreground">
                                                        {approval.employee.firstName[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="font-medium text-foreground">
                                                        {approval.employee.firstName} {approval.employee.lastName}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        {approval.employee.designation?.name || t("noDesignation")}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Expense Details */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                                        {approval.category}
                                                    </Badge>
                                                    <span className="text-2xl font-bold text-foreground">
                                                        {formatCurrency(approval.amount || 0)}
                                                    </span>
                                                </div>
                                                <p className="text-muted-foreground text-sm">
                                                    {approval.description}
                                                </p>
                                                <p className="text-tertiary-foreground text-xs mt-2">
                                                    {t("submittedOn")} {new Date(approval.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleReject(approval.id, "expense")}
                                                    disabled={processingId === approval.id}
                                                    className="border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                >
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    {t("reject")}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove(approval.id, "expense")}
                                                    disabled={processingId === approval.id}
                                                    className="bg-green-600 hover:bg-green-500"
                                                >
                                                    {processingId === approval.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="h-4 w-4 mr-1" />
                                                            {t("approve")}
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
