"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Calendar,
    Plus,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Clock,
    FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaveBalance {
    id: string;
    type: string;
    typeBn: string;
    code: string;
    total: number;
    used: number;
    remaining: number;
    color: string;
}

interface LeaveApplication {
    id: string;
    type: string;
    fromDate: string;
    toDate: string;
    days: number;
    reason: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    appliedOn: string;
    approvedBy?: string;
    rejectionReason?: string;
}

export default function ESSLeavesPage() {
    const { data: session } = useSession();
    const [isLoading, setIsLoading] = useState(true);
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [applications, setApplications] = useState<LeaveApplication[]>([]);
    const [activeTab, setActiveTab] = useState("balances");

    useEffect(() => {
        const fetchData = async () => {
            try {
                await new Promise((resolve) => setTimeout(resolve, 1000));

                setBalances([
                    {
                        id: "1",
                        type: "Casual Leave",
                        typeBn: "নৈমিত্তিক ছুটি",
                        code: "CL",
                        total: 10,
                        used: 2,
                        remaining: 8,
                        color: "blue",
                    },
                    {
                        id: "2",
                        type: "Sick Leave",
                        typeBn: "অসুস্থতা ছুটি",
                        code: "SL",
                        total: 14,
                        used: 3,
                        remaining: 11,
                        color: "red",
                    },
                    {
                        id: "3",
                        type: "Annual Leave",
                        typeBn: "বার্ষিক ছুটি",
                        code: "AL",
                        total: 15,
                        used: 5,
                        remaining: 10,
                        color: "green",
                    },
                    {
                        id: "4",
                        type: "Compensatory Leave",
                        typeBn: "ক্ষতিপূরণ ছুটি",
                        code: "CO",
                        total: 3,
                        used: 1,
                        remaining: 2,
                        color: "purple",
                    },
                ]);

                setApplications([
                    {
                        id: "1",
                        type: "Annual Leave",
                        fromDate: "2026-02-05",
                        toDate: "2026-02-06",
                        days: 2,
                        reason: "Family vacation",
                        status: "pending",
                        appliedOn: "2026-01-28",
                    },
                    {
                        id: "2",
                        type: "Casual Leave",
                        fromDate: "2026-01-15",
                        toDate: "2026-01-15",
                        days: 1,
                        reason: "Personal work",
                        status: "approved",
                        appliedOn: "2026-01-10",
                        approvedBy: "Jane Smith",
                    },
                    {
                        id: "3",
                        type: "Sick Leave",
                        fromDate: "2025-12-20",
                        toDate: "2025-12-22",
                        days: 3,
                        reason: "Fever and cold",
                        status: "approved",
                        appliedOn: "2025-12-20",
                        approvedBy: "Jane Smith",
                    },
                    {
                        id: "4",
                        type: "Casual Leave",
                        fromDate: "2025-11-10",
                        toDate: "2025-11-10",
                        days: 1,
                        reason: "Bank work",
                        status: "rejected",
                        appliedOn: "2025-11-08",
                        rejectionReason: "Peak project deadline",
                    },
                ]);
            } catch (error) {
                console.error("Error fetching leave data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
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
            case "cancelled":
                return (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                        Cancelled
                    </Badge>
                );
            default:
                return null;
        }
    };

    const getColorClass = (color: string) => {
        switch (color) {
            case "blue":
                return "from-blue-500/20 to-blue-600/10 border-blue-500/20";
            case "red":
                return "from-red-500/20 to-red-600/10 border-red-500/20";
            case "green":
                return "from-green-500/20 to-green-600/10 border-green-500/20";
            case "purple":
                return "from-purple-500/20 to-purple-600/10 border-purple-500/20";
            default:
                return "from-white/10 to-white/5 border-white/10";
        }
    };

    const getProgressColor = (color: string) => {
        switch (color) {
            case "blue":
                return "from-blue-500 to-blue-600";
            case "red":
                return "from-red-500 to-red-600";
            case "green":
                return "from-green-500 to-green-600";
            case "purple":
                return "from-purple-500 to-purple-600";
            default:
                return "from-white/50 to-white/30";
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    <h1 className="text-2xl font-bold text-white">My Leaves</h1>
                    <p className="text-white/60 mt-1">
                        Manage your leave balances and applications
                    </p>
                </div>
                <Link href="/ess/leaves/apply">
                    <Button className="bg-blue-600 hover:bg-blue-500">
                        <Plus className="h-4 w-4 mr-2" />
                        Apply for Leave
                    </Button>
                </Link>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-[#141419] border border-white/5">
                    <TabsTrigger
                        value="balances"
                        className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
                    >
                        Leave Balance
                    </TabsTrigger>
                    <TabsTrigger
                        value="applications"
                        className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
                    >
                        My Applications
                    </TabsTrigger>
                </TabsList>

                {/* Leave Balance Tab */}
                <TabsContent value="balances" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {balances.map((balance) => (
                            <Card
                                key={balance.id}
                                className={`bg-gradient-to-br ${getColorClass(balance.color)} border`}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-2xl font-bold text-white/20">
                                            {balance.code}
                                        </span>
                                        <Calendar className="h-5 w-5 text-white/40" />
                                    </div>
                                    <p className="text-sm text-white/60">{balance.type}</p>
                                    <p className="text-xs text-white/40">{balance.typeBn}</p>
                                    <div className="mt-4 flex items-end gap-2">
                                        <span className="text-4xl font-bold text-white">
                                            {balance.remaining}
                                        </span>
                                        <span className="text-sm text-white/40 mb-1">
                                            / {balance.total} days
                                        </span>
                                    </div>
                                    <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(balance.color)}`}
                                            style={{
                                                width: `${(balance.remaining / balance.total) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 flex justify-between text-xs text-white/40">
                                        <span>Used: {balance.used}</span>
                                        <span>Remaining: {balance.remaining}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Applications Tab */}
                <TabsContent value="applications" className="mt-6">
                    <Card className="bg-[#141419] border-white/5">
                        <CardContent className="p-0">
                            <div className="divide-y divide-white/5">
                                {applications.map((app) => (
                                    <div
                                        key={app.id}
                                        className="p-4 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                    <FileText className="h-6 w-6 text-blue-400" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-white">
                                                            {app.type}
                                                        </p>
                                                        {getStatusBadge(app.status)}
                                                    </div>
                                                    <p className="text-sm text-white/60 mt-1">
                                                        {new Date(app.fromDate).toLocaleDateString()} -{" "}
                                                        {new Date(app.toDate).toLocaleDateString()} ({app.days}{" "}
                                                        {app.days === 1 ? "day" : "days"})
                                                    </p>
                                                    <p className="text-sm text-white/40 mt-1">
                                                        Reason: {app.reason}
                                                    </p>
                                                    {app.approvedBy && (
                                                        <p className="text-xs text-green-400/60 mt-1">
                                                            Approved by: {app.approvedBy}
                                                        </p>
                                                    )}
                                                    {app.rejectionReason && (
                                                        <p className="text-xs text-red-400/60 mt-1">
                                                            Rejection reason: {app.rejectionReason}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-white/40">
                                                    Applied: {new Date(app.appliedOn).toLocaleDateString()}
                                                </p>
                                                {app.status === "pending" && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
