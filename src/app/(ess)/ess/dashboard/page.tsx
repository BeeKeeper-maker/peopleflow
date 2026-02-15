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
    Loader2,
    LogOut,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { toBengaliNumber } from "@/lib/i18n-utils";

interface LeaveBalance {
    leaveType: {
        id: string;
        name: string;
        code: string;
    };
    allocatedDays: number;
    usedDays: number;
    remainingDays: number;
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
    createdAt: string;
    status?: string;
}

interface TodayAttendance {
    checkedIn: boolean;
    checkInTime?: string;
    checkOutTime?: string;
}

export default function ESSDashboardPage() {
    const { data: session } = useSession();
    const t = useTranslations('ESS');
    const [isLoading, setIsLoading] = useState(true);
    const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
    const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
    const [activities, setActivities] = useState<RecentActivity[]>([]);
    const [todayStatus, setTodayStatus] = useState<TodayAttendance>({ checkedIn: false });
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const user = session?.user;
    const firstName = user?.name?.split(" ")[0] || "User";

    // Get greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('goodMorning');
        if (hour < 17) return t('goodAfternoon');
        return t('goodEvening');
    };

    // Fetch dashboard data from real APIs
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch leave balances
                const balancesRes = await fetch("/api/leaves/allocations");
                if (balancesRes.ok) {
                    const data = await balancesRes.json();
                    setLeaveBalances(data.data || data || []);
                }

                // Fetch today's attendance
                const today = new Date().toISOString().split("T")[0];
                const attendanceRes = await fetch(`/api/attendance?date=${today}`);
                if (attendanceRes.ok) {
                    const data = await attendanceRes.json();
                    const records = data.data || data || [];

                    // Check if current user has checked in today
                    if (records.length > 0) {
                        const myRecord = records[0];
                        setTodayStatus({
                            checkedIn: !!myRecord.checkIn,
                            checkInTime: myRecord.checkIn
                                ? new Date(myRecord.checkIn).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true
                                })
                                : undefined,
                            checkOutTime: myRecord.checkOut
                                ? new Date(myRecord.checkOut).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true
                                })
                                : undefined,
                        });
                    }
                }

                // Fetch this month's attendance summary
                const monthStartDate = new Date();
                monthStartDate.setDate(1);
                const summaryRes = await fetch(`/api/attendance?startDate=${monthStartDate.toISOString().split("T")[0]}`);
                if (summaryRes.ok) {
                    const data = await summaryRes.json();
                    const records = data.data || data || [];

                    // Count statuses
                    let present = 0, absent = 0, late = 0, onLeave = 0;
                    records.forEach((record: { status: string }) => {
                        switch (record.status) {
                            case "present": present++; break;
                            case "absent": absent++; break;
                            case "late": late++; break;
                            case "on_leave": onLeave++; break;
                        }
                    });

                    setAttendance({ present, absent, late, onLeave });
                }

                // Fetch recent notifications as activities
                const notifRes = await fetch("/api/notifications?limit=5");
                if (notifRes.ok) {
                    const data = await notifRes.json();
                    const notifications = data.notifications || data.data || data || [];
                    setActivities(notifications.map((n: { id: string; type: string; title: string; createdAt: string; status?: string }) => ({
                        id: n.id,
                        type: n.type || "general",
                        message: n.title,
                        createdAt: n.createdAt,
                        status: n.status,
                    })));
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleCheckIn = async () => {
        setIsCheckingIn(true);
        try {
            const res = await fetch("/api/attendance/check-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source: "web" }),
            });

            if (res.ok) {
                const data = await res.json();
                setTodayStatus({
                    checkedIn: true,
                    checkInTime: new Date(data.checkIn).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                    }),
                });
                toast.success("Checked in successfully!");
            } else {
                const errorText = await res.text();
                toast.error(errorText || "Failed to check in");
            }
        } catch (error) {
            console.error("Check-in error:", error);
            toast.error("An error occurred while checking in");
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handleCheckOut = async () => {
        setIsCheckingOut(true);
        try {
            const res = await fetch("/api/attendance/check-in", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });

            if (res.ok) {
                const data = await res.json();
                setTodayStatus({
                    checkedIn: true,
                    checkInTime: todayStatus.checkInTime,
                    checkOutTime: new Date(data.checkOut).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                    }),
                });
                toast.success("Checked out successfully!");
            } else {
                const errorText = await res.text();
                toast.error(errorText || "Failed to check out");
            }
        } catch (error) {
            console.error("Check-out error:", error);
            toast.error("An error occurred while checking out");
        } finally {
            setIsCheckingOut(false);
        }
    };

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
                    <Avatar className="h-16 w-16 border-2 border-card-border">
                        <AvatarImage src={user?.image || undefined} />
                        <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-foreground text-xl">
                            {firstName[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {getGreeting()}, {firstName}! 👋
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>

                {/* Today's Status */}
                <div className="flex items-center gap-3">
                    {todayStatus.checkedIn ? (
                        <>
                            <div className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                                    <div>
                                        <p className="text-sm font-medium text-green-400">{t('checkedIn')}</p>
                                        <p className="text-xs text-green-400/60">{todayStatus.checkInTime}</p>
                                    </div>
                                </div>
                            </div>
                            {todayStatus.checkOutTime ? (
                                <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                    <div className="flex items-center gap-2">
                                        <LogOut className="h-5 w-5 text-purple-400" />
                                        <div>
                                            <p className="text-sm font-medium text-purple-400">{t('checkedOut')}</p>
                                            <p className="text-xs text-purple-400/60">{todayStatus.checkOutTime}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    className="bg-red-600 hover:bg-red-500"
                                    onClick={handleCheckOut}
                                    disabled={isCheckingOut}
                                >
                                    {isCheckingOut ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <LogOut className="h-4 w-4 mr-2" />
                                    )}
                                    {t('checkOut')}
                                </Button>
                            )}
                        </>
                    ) : (
                        <Button
                            className="bg-blue-600 hover:bg-blue-500"
                            onClick={handleCheckIn}
                            disabled={isCheckingIn}
                        >
                            {isCheckingIn ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Clock className="h-4 w-4 mr-2" />
                            )}
                            {t('checkIn')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/ess/leaves/apply">
                    <Card className="bg-linear-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer group relative">
                        <CardContent className="p-4">
                            <Calendar className="h-8 w-8 text-blue-400 mb-3" />
                            <p className="text-sm font-medium text-foreground">{t('applyLeave')}</p>
                            <ArrowUpRight className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4" />
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/ess/payslips">
                    <Card className="bg-linear-to-br from-green-500/10 to-green-600/5 border-green-500/20 hover:border-green-500/40 transition-all cursor-pointer group relative">
                        <CardContent className="p-4">
                            <Receipt className="h-8 w-8 text-green-400 mb-3" />
                            <p className="text-sm font-medium text-foreground">{t('viewPayslips')}</p>
                            <ArrowUpRight className="h-4 w-4 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4" />
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/ess/attendance">
                    <Card className="bg-linear-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer group relative">
                        <CardContent className="p-4">
                            <Clock className="h-8 w-8 text-purple-400 mb-3" />
                            <p className="text-sm font-medium text-foreground">{t('viewAttendance')}</p>
                            <ArrowUpRight className="h-4 w-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4" />
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/ess/profile">
                    <Card className="bg-linear-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20 hover:border-orange-500/40 transition-all cursor-pointer group relative">
                        <CardContent className="p-4">
                            <Target className="h-8 w-8 text-orange-400 mb-3" />
                            <p className="text-sm font-medium text-foreground">{t('myProfile')}</p>
                            <ArrowUpRight className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4" />
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Leave Balance */}
                <Card className="bg-card border-card-border lg:col-span-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-foreground text-lg">{t('leaveBalance')}</CardTitle>
                            <Link href="/ess/leaves">
                                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                                    {t('viewAll')}
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {leaveBalances.length === 0 ? (
                            <div className="text-center py-8">
                                <Calendar className="h-10 w-10 mx-auto text-muted-text mb-3" />
                                <p className="text-tertiary-foreground">{t('noLeaveTypes')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {leaveBalances.slice(0, 3).map((leave) => (
                                    <div
                                        key={leave.leaveType.id}
                                        className="p-4 rounded-xl bg-hover border border-card-border"
                                    >
                                        <p className="text-sm text-muted-foreground">{leave.leaveType.name}</p>
                                        <div className="mt-2 flex items-end gap-2">
                                            <span className="text-3xl font-bold text-foreground">
                                                {leave.remainingDays}
                                            </span>
                                            <span className="text-sm text-tertiary-foreground mb-1">
                                                / {leave.allocatedDays} {t('days')}
                                            </span>
                                        </div>
                                        <div className="mt-3 h-2 rounded-full bg-hover overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-linear-to-r from-blue-500 to-purple-500"
                                                style={{
                                                    width: `${leave.allocatedDays > 0 ? (leave.remainingDays / leave.allocatedDays) * 100 : 0}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* This Month Attendance */}
                <Card className="bg-card border-card-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-foreground text-lg">{t('thisMonth')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {attendance ? (
                                <>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-green-400" />
                                            <span className="text-foreground">{t('present')}</span>
                                        </div>
                                        <span className="text-lg font-bold text-green-400">
                                            {attendance.present}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                                        <div className="flex items-center gap-3">
                                            <XCircle className="h-5 w-5 text-red-400" />
                                            <span className="text-foreground">{t('absent')}</span>
                                        </div>
                                        <span className="text-lg font-bold text-red-400">
                                            {attendance.absent}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="h-5 w-5 text-yellow-400" />
                                            <span className="text-foreground">{t('late')}</span>
                                        </div>
                                        <span className="text-lg font-bold text-yellow-400">
                                            {attendance.late}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-5 w-5 text-blue-400" />
                                            <span className="text-foreground">{t('onLeave')}</span>
                                        </div>
                                        <span className="text-lg font-bold text-blue-400">
                                            {attendance.onLeave}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <Clock className="h-10 w-10 mx-auto text-muted-text mb-3" />
                                    <p className="text-tertiary-foreground">{t('noAttendanceData')}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card className="bg-card border-card-border">
                <CardHeader className="pb-3">
                    <CardTitle className="text-foreground text-lg">{t('recentActivity')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {activities.length === 0 ? (
                        <div className="text-center py-8">
                            <Clock className="h-10 w-10 mx-auto text-muted-text mb-3" />
                            <p className="text-tertiary-foreground">{t('noRecentActivity')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activities.map((activity) => (
                                <div
                                    key={activity.id}
                                    className="flex items-center justify-between p-4 rounded-xl bg-hover border border-card-border"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.type === "leave" || activity.type === "leave_approval"
                                                ? "bg-blue-500/20"
                                                : activity.type === "payroll"
                                                    ? "bg-green-500/20"
                                                    : "bg-purple-500/20"
                                                }`}
                                        >
                                            {activity.type === "leave" || activity.type === "leave_approval" ? (
                                                <Calendar className="h-5 w-5 text-blue-400" />
                                            ) : activity.type === "payroll" ? (
                                                <Receipt className="h-5 w-5 text-green-400" />
                                            ) : (
                                                <Target className="h-5 w-5 text-purple-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {activity.message}
                                            </p>
                                            <p className="text-xs text-tertiary-foreground">
                                                {new Date(activity.createdAt).toLocaleDateString()}
                                            </p>
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
                    )}
                </CardContent>
            </Card>
        </div >
    );
}
