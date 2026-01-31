"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Calendar,
    Clock,
    Receipt,
    Target,
    ChevronRight,
    ArrowUpRight,
    CheckCircle2,
    XCircle,
    AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaveBalance {
    type: string;
    total: number;
    used: number;
    remaining: number;
}

interface AttendanceSummary {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
}

interface RecentActivity {
    id: string;
    type: string;
    message: string;
    date: string;
    status?: string;
}

export default function ESSDashboardPage() {
    const { data: session } = useSession();
    const [isLoading, setIsLoading] = useState(true);
    const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
    const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
    const [activities, setActivities] = useState<RecentActivity[]>([]);
    const [todayStatus, setTodayStatus] = useState<{
        checkedIn: boolean;
        checkInTime?: string;
        checkOutTime?: string;
    }>({ checkedIn: false });

    const user = session?.user;
    const firstName = user?.name?.split(" ")[0] || "User";

    // Get greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    };

    // Fetch dashboard data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // TODO: Fetch real data from APIs
                // For now, using mock data
                await new Promise((resolve) => setTimeout(resolve, 1000));

                setLeaveBalances([
                    { type: "Casual Leave", total: 10, used: 2, remaining: 8 },
                    { type: "Sick Leave", total: 14, used: 3, remaining: 11 },
                    { type: "Annual Leave", total: 15, used: 5, remaining: 10 },
                ]);

                setAttendance({
                    present: 20,
                    absent: 1,
                    late: 2,
                    onLeave: 2,
                });

                setTodayStatus({
                    checkedIn: true,
                    checkInTime: "9:02 AM",
                });

                setActivities([
                    {
                        id: "1",
                        type: "leave",
                        message: "Annual Leave approved by Manager",
                        date: "Jan 28, 2026",
                        status: "approved",
                    },
                    {
                        id: "2",
                        type: "payslip",
                        message: "January 2026 payslip generated",
                        date: "Jan 01, 2026",
                    },
                    {
                        id: "3",
                        type: "goal",
                        message: "Q1 Goals assigned by HR",
                        date: "Dec 28, 2025",
                    },
                ]);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-white/10">
                        <AvatarImage src={user?.image || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl">
                            {firstName[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {getGreeting()}, {firstName}! 👋
                        </h1>
                        <p className="text-white/60 mt-1">
                            Here's your personal dashboard for today.
                        </p>
                    </div>
                </div>

                {/* Today's Status */}
                <div className="flex items-center gap-3">
                    {todayStatus.checkedIn ? (
                        <div className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-400" />
                                <div>
                                    <p className="text-sm font-medium text-green-400">Checked In</p>
                                    <p className="text-xs text-green-400/60">{todayStatus.checkInTime}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Button className="bg-blue-600 hover:bg-blue-500">
                            <Clock className="h-4 w-4 mr-2" />
                            Check In
                        </Button>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/ess/leaves/apply">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer group">
                        <CardContent className="p-4">
                            <Calendar className="h-8 w-8 text-blue-400 mb-3" />
                            <p className="text-sm font-medium text-white">Apply Leave</p>
                            <ArrowUpRight className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4" />
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/ess/payslips">
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 hover:border-green-500/40 transition-all cursor-pointer group">
                        <CardContent className="p-4">
                            <Receipt className="h-8 w-8 text-green-400 mb-3" />
                            <p className="text-sm font-medium text-white">View Payslips</p>
                            <ArrowUpRight className="h-4 w-4 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4" />
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/ess/attendance">
                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer group">
                        <CardContent className="p-4">
                            <Clock className="h-8 w-8 text-purple-400 mb-3" />
                            <p className="text-sm font-medium text-white">Attendance</p>
                            <ArrowUpRight className="h-4 w-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4" />
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/ess/goals">
                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20 hover:border-orange-500/40 transition-all cursor-pointer group">
                        <CardContent className="p-4">
                            <Target className="h-8 w-8 text-orange-400 mb-3" />
                            <p className="text-sm font-medium text-white">My Goals</p>
                            <ArrowUpRight className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4" />
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Leave Balance */}
                <Card className="bg-[#141419] border-white/5 lg:col-span-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-white text-lg">Leave Balance</CardTitle>
                            <Link href="/ess/leaves">
                                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                                    View All
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {leaveBalances.map((leave) => (
                                <div
                                    key={leave.type}
                                    className="p-4 rounded-xl bg-white/5 border border-white/5"
                                >
                                    <p className="text-sm text-white/60">{leave.type}</p>
                                    <div className="mt-2 flex items-end gap-2">
                                        <span className="text-3xl font-bold text-white">
                                            {leave.remaining}
                                        </span>
                                        <span className="text-sm text-white/40 mb-1">
                                            / {leave.total} days
                                        </span>
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                                            style={{
                                                width: `${(leave.remaining / leave.total) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* This Month Attendance */}
                <Card className="bg-[#141419] border-white/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-white text-lg">This Month</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {attendance && (
                                <>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-green-400" />
                                            <span className="text-white/80">Present</span>
                                        </div>
                                        <span className="text-lg font-bold text-green-400">
                                            {attendance.present}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                                        <div className="flex items-center gap-3">
                                            <XCircle className="h-5 w-5 text-red-400" />
                                            <span className="text-white/80">Absent</span>
                                        </div>
                                        <span className="text-lg font-bold text-red-400">
                                            {attendance.absent}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="h-5 w-5 text-yellow-400" />
                                            <span className="text-white/80">Late</span>
                                        </div>
                                        <span className="text-lg font-bold text-yellow-400">
                                            {attendance.late}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-5 w-5 text-blue-400" />
                                            <span className="text-white/80">On Leave</span>
                                        </div>
                                        <span className="text-lg font-bold text-blue-400">
                                            {attendance.onLeave}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card className="bg-[#141419] border-white/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-white text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {activities.map((activity) => (
                            <div
                                key={activity.id}
                                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5"
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.type === "leave"
                                                ? "bg-blue-500/20"
                                                : activity.type === "payslip"
                                                    ? "bg-green-500/20"
                                                    : "bg-purple-500/20"
                                            }`}
                                    >
                                        {activity.type === "leave" ? (
                                            <Calendar className="h-5 w-5 text-blue-400" />
                                        ) : activity.type === "payslip" ? (
                                            <Receipt className="h-5 w-5 text-green-400" />
                                        ) : (
                                            <Target className="h-5 w-5 text-purple-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">
                                            {activity.message}
                                        </p>
                                        <p className="text-xs text-white/40">{activity.date}</p>
                                    </div>
                                </div>
                                {activity.status && (
                                    <Badge
                                        className={
                                            activity.status === "approved"
                                                ? "bg-green-500/20 text-green-400 border-green-500/30"
                                                : "bg-red-500/20 text-red-400 border-red-500/30"
                                        }
                                    >
                                        {activity.status}
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
