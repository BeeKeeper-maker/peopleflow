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

interface PendingApproval {
    id: string;
    type: "leave" | "expense";
    employeeId: string;
    employeeName: string;
    employeeDesignation: string;
    employeeAvatar?: string;

    // Leave specific
    leaveType?: string;
    fromDate?: string;
    toDate?: string;
    days?: number;
    reason?: string;

    // Expense specific
    expenseCategory?: string;
    amount?: number;
    description?: string;
    receiptUrl?: string;

    appliedOn: string;
}

export default function ManagerApprovalsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [leaveApprovals, setLeaveApprovals] = useState<PendingApproval[]>([]);
    const [expenseApprovals, setExpenseApprovals] = useState<PendingApproval[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
    const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                await new Promise((resolve) => setTimeout(resolve, 1000));

                setLeaveApprovals([
                    {
                        id: "1",
                        type: "leave",
                        employeeId: "emp1",
                        employeeName: "Rahul Ahmed",
                        employeeDesignation: "Senior Developer",
                        leaveType: "Casual Leave",
                        fromDate: "2026-02-05",
                        toDate: "2026-02-06",
                        days: 2,
                        reason: "Family vacation - cousin's wedding",
                        appliedOn: "2026-01-28",
                    },
                    {
                        id: "2",
                        type: "leave",
                        employeeId: "emp2",
                        employeeName: "Sarah Islam",
                        employeeDesignation: "QA Engineer",
                        leaveType: "Sick Leave",
                        fromDate: "2026-02-03",
                        toDate: "2026-02-03",
                        days: 1,
                        reason: "Doctor's appointment for regular checkup",
                        appliedOn: "2026-02-01",
                    },
                ]);

                setExpenseApprovals([
                    {
                        id: "3",
                        type: "expense",
                        employeeId: "emp3",
                        employeeName: "Mohammed Ali",
                        employeeDesignation: "DevOps Engineer",
                        expenseCategory: "Travel",
                        amount: 5000,
                        description: "Uber rides for client meeting at Gulshan office",
                        appliedOn: "2026-01-28",
                    },
                    {
                        id: "4",
                        type: "expense",
                        employeeId: "emp1",
                        employeeName: "Rahul Ahmed",
                        employeeDesignation: "Senior Developer",
                        expenseCategory: "Software",
                        amount: 2500,
                        description: "JetBrains IDE subscription - 1 month",
                        appliedOn: "2026-01-25",
                    },
                ]);
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
            // TODO: Call API to approve
            await new Promise((resolve) => setTimeout(resolve, 1000));

            if (type === "leave") {
                setLeaveApprovals((prev) => prev.filter((a) => a.id !== id));
            } else {
                setExpenseApprovals((prev) => prev.filter((a) => a.id !== id));
            }
        } catch (error) {
            console.error("Error approving:", error);
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
            // TODO: Call API to reject with reason
            await new Promise((resolve) => setTimeout(resolve, 1000));

            if (type === "leave") {
                setLeaveApprovals((prev) => prev.filter((a) => a.id !== id));
            } else {
                setExpenseApprovals((prev) => prev.filter((a) => a.id !== id));
            }
        } catch (error) {
            console.error("Error rejecting:", error);
        } finally {
            setProcessingId(null);
            setShowRejectInput(null);
            setRejectReason((prev) => {
                const { [id]: _, ...rest } = prev;
                return rest;
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
                <h1 className="text-2xl font-bold text-white">Pending Approvals</h1>
                <p className="text-white/60 mt-1">
                    {totalPending} {totalPending === 1 ? "request" : "requests"} waiting for your action
                </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="leaves">
                <TabsList className="bg-[#141419] border border-white/5">
                    <TabsTrigger
                        value="leaves"
                        className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
                    >
                        <Calendar className="h-4 w-4 mr-2" />
                        Leaves ({leaveApprovals.length})
                    </TabsTrigger>
                    <TabsTrigger
                        value="expenses"
                        className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
                    >
                        <Receipt className="h-4 w-4 mr-2" />
                        Expenses ({expenseApprovals.length})
                    </TabsTrigger>
                </TabsList>

                {/* Leave Approvals */}
                <TabsContent value="leaves" className="mt-6">
                    {leaveApprovals.length === 0 ? (
                        <Card className="bg-[#141419] border-white/5">
                            <CardContent className="py-12 text-center">
                                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                                <p className="text-white font-medium">All caught up!</p>
                                <p className="text-white/60 text-sm mt-1">
                                    No pending leave requests
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {leaveApprovals.map((approval) => (
                                <Card key={approval.id} className="bg-[#141419] border-white/5">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                            {/* Employee Info */}
                                            <div className="flex items-center gap-4 min-w-[200px]">
                                                <Avatar className="h-12 w-12">
                                                    <AvatarImage src={approval.employeeAvatar} />
                                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                                        {approval.employeeName[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="font-medium text-white">
                                                        {approval.employeeName}
                                                    </h3>
                                                    <p className="text-sm text-white/60">
                                                        {approval.employeeDesignation}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Leave Details */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                                        {approval.leaveType}
                                                    </Badge>
                                                    <span className="text-white/60 text-sm">
                                                        {approval.days} {approval.days === 1 ? "day" : "days"}
                                                    </span>
                                                </div>
                                                <p className="text-white">
                                                    {new Date(approval.fromDate!).toLocaleDateString()} -{" "}
                                                    {new Date(approval.toDate!).toLocaleDateString()}
                                                </p>
                                                <p className="text-white/60 text-sm mt-1">
                                                    Reason: {approval.reason}
                                                </p>
                                                <p className="text-white/40 text-xs mt-2">
                                                    Applied on {new Date(approval.appliedOn).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-2">
                                                {showRejectInput === approval.id ? (
                                                    <div className="space-y-2">
                                                        <Textarea
                                                            placeholder="Reason for rejection..."
                                                            value={rejectReason[approval.id] || ""}
                                                            onChange={(e) =>
                                                                setRejectReason((prev) => ({
                                                                    ...prev,
                                                                    [approval.id]: e.target.value,
                                                                }))
                                                            }
                                                            className="bg-white/5 border-white/10 text-white min-w-[200px]"
                                                        />
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setShowRejectInput(null)}
                                                                className="text-white/60"
                                                            >
                                                                Cancel
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
                                                                    "Confirm Reject"
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
                                                            Reject
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
                                                                    Approve
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
                        <Card className="bg-[#141419] border-white/5">
                            <CardContent className="py-12 text-center">
                                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                                <p className="text-white font-medium">All caught up!</p>
                                <p className="text-white/60 text-sm mt-1">
                                    No pending expense claims
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {expenseApprovals.map((approval) => (
                                <Card key={approval.id} className="bg-[#141419] border-white/5">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                            {/* Employee Info */}
                                            <div className="flex items-center gap-4 min-w-[200px]">
                                                <Avatar className="h-12 w-12">
                                                    <AvatarImage src={approval.employeeAvatar} />
                                                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                                                        {approval.employeeName[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="font-medium text-white">
                                                        {approval.employeeName}
                                                    </h3>
                                                    <p className="text-sm text-white/60">
                                                        {approval.employeeDesignation}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Expense Details */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                                        {approval.expenseCategory}
                                                    </Badge>
                                                    <span className="text-2xl font-bold text-white">
                                                        {formatCurrency(approval.amount || 0)}
                                                    </span>
                                                </div>
                                                <p className="text-white/60 text-sm">
                                                    {approval.description}
                                                </p>
                                                <p className="text-white/40 text-xs mt-2">
                                                    Submitted on {new Date(approval.appliedOn).toLocaleDateString()}
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
                                                    Reject
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
                                                            Approve
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
