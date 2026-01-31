"use client";

import { useEffect, useState } from "react";
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Clock,
    XCircle,
    AlertTriangle,
    Palmtree,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamLeave {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeDesignation: string;
    employeeAvatar?: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    days: number;
    status: "approved" | "pending" | "rejected";
    reason: string;
}

export default function ManagerLeavesPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [teamLeaves, setTeamLeaves] = useState<TeamLeave[]>([]);

    const monthName = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                await new Promise((resolve) => setTimeout(resolve, 800));

                setTeamLeaves([
                    {
                        id: "1",
                        employeeId: "emp1",
                        employeeName: "Rahul Ahmed",
                        employeeDesignation: "Senior Developer",
                        leaveType: "Casual Leave",
                        fromDate: "2026-02-05",
                        toDate: "2026-02-06",
                        days: 2,
                        status: "pending",
                        reason: "Family vacation - cousin's wedding",
                    },
                    {
                        id: "2",
                        employeeId: "emp4",
                        employeeName: "Sarah Islam",
                        employeeDesignation: "QA Engineer",
                        leaveType: "Sick Leave",
                        fromDate: "2026-02-03",
                        toDate: "2026-02-03",
                        days: 1,
                        status: "approved",
                        reason: "Doctor's appointment",
                    },
                    {
                        id: "3",
                        employeeId: "emp2",
                        employeeName: "Fatima Khan",
                        employeeDesignation: "UI Designer",
                        leaveType: "Annual Leave",
                        fromDate: "2026-02-15",
                        toDate: "2026-02-20",
                        days: 6,
                        status: "pending",
                        reason: "Planning to visit family in Sylhet",
                    },
                    {
                        id: "4",
                        employeeId: "emp3",
                        employeeName: "Imran Hossain",
                        employeeDesignation: "Backend Developer",
                        leaveType: "Casual Leave",
                        fromDate: "2026-01-28",
                        toDate: "2026-01-28",
                        days: 1,
                        status: "approved",
                        reason: "Personal errand",
                    },
                    {
                        id: "5",
                        employeeId: "emp5",
                        employeeName: "Mohammed Ali",
                        employeeDesignation: "DevOps Engineer",
                        leaveType: "Sick Leave",
                        fromDate: "2026-01-25",
                        toDate: "2026-01-25",
                        days: 1,
                        status: "rejected",
                        reason: "Not feeling well",
                    },
                ]);
            } catch (error) {
                console.error("Error fetching team leaves:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [currentMonth]);

    const goToPreviousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Approved
                    </Badge>
                );
            case "pending":
                return (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                    </Badge>
                );
            case "rejected":
                return (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        Rejected
                    </Badge>
                );
            default:
                return null;
        }
    };

    const getLeaveTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            "Casual Leave": "bg-blue-500/20 text-blue-400 border-blue-500/30",
            "Sick Leave": "bg-red-500/20 text-red-400 border-red-500/30",
            "Annual Leave": "bg-purple-500/20 text-purple-400 border-purple-500/30",
            "Maternity Leave": "bg-pink-500/20 text-pink-400 border-pink-500/30",
        };
        return (
            <Badge className={colors[type] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}>
                {type}
            </Badge>
        );
    };

    // Stats
    const stats = {
        pending: teamLeaves.filter((l) => l.status === "pending").length,
        approved: teamLeaves.filter((l) => l.status === "approved").length,
        rejected: teamLeaves.filter((l) => l.status === "rejected").length,
        totalDays: teamLeaves.filter((l) => l.status === "approved").reduce((acc, l) => acc + l.days, 0),
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
                    <h1 className="text-2xl font-bold text-white">Team Leaves</h1>
                    <p className="text-white/60 mt-1">
                        Track your team's leave applications
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToPreviousMonth}
                        className="border-white/10 text-white/60 hover:text-white"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-4 py-2 bg-[#141419] rounded-lg text-white font-medium min-w-[160px] text-center">
                        {monthName}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToNextMonth}
                        className="border-white/10 text-white/60 hover:text-white"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
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
                            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                <XCircle className="h-5 w-5 text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stats.rejected}</p>
                                <p className="text-xs text-white/60">Rejected</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Palmtree className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{stats.totalDays}</p>
                                <p className="text-xs text-white/60">Total Days Off</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Leave List */}
            <Card className="bg-[#141419] border-white/5">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-orange-400" />
                        Leave Applications
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Employee</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Type</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Duration</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-white/60">Days</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Reason</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teamLeaves.map((leave) => (
                                    <tr
                                        key={leave.id}
                                        className="border-b border-white/5 hover:bg-white/5"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={leave.employeeAvatar} />
                                                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-red-600 text-white text-xs">
                                                        {leave.employeeName[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{leave.employeeName}</p>
                                                    <p className="text-xs text-white/40">{leave.employeeDesignation}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {getLeaveTypeBadge(leave.leaveType)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white">
                                            {new Date(leave.fromDate).toLocaleDateString()}
                                            {leave.fromDate !== leave.toDate && (
                                                <> - {new Date(leave.toDate).toLocaleDateString()}</>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-white font-medium">{leave.days}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white/60 max-w-[200px] truncate">
                                            {leave.reason}
                                        </td>
                                        <td className="px-4 py-3">
                                            {getStatusBadge(leave.status)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Upcoming/Current Leaves Warning */}
            <Card className="bg-[#141419] border-yellow-500/30">
                <CardContent className="p-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                        <h4 className="text-white font-medium">Staffing Alert</h4>
                        <p className="text-white/60 text-sm mt-1">
                            {stats.pending} pending leave request(s) need your attention.
                            Review and take action to maintain optimal team coverage.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
