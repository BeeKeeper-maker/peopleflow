"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from 'next-intl';
import { useLocale as useNextIntlLocale } from "next-intl";
import { formatNumber } from "@/lib/i18n-utils";
import {
    Users,
    UserCheck,
    CalendarOff,
    Clock,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    Calendar,
    Banknote,
    AlertCircle,
    type LucideIcon,
} from "lucide-react";

interface DashboardStats {
    totalEmployees: number;
    presentToday: number;
    onLeaveToday: number;
    pendingLeaves: number;
    attendancePercentage: number;
}

interface RecentActivity {
    type: string;
    title: string;
    description: string;
    time: string;
    avatar: string;
}

interface PendingApproval {
    id: string;
    name: string;
    type: string;
    details: string;
}

// Stat Card - Pure presentation
function StatCard({
    title,
    value,
    change,
    changeType,
    Icon,
    color,
    glowClass = "",
    loading = false
}: {
    title: string;
    value: string;
    change: string;
    changeType: "positive" | "negative" | "neutral" | "warning";
    Icon: LucideIcon;
    color: string;
    glowClass?: string;
    loading?: boolean;
}) {
    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-12 w-12 rounded-xl" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
                        <div className="flex items-center gap-1 mt-2">
                            {changeType === "positive" && (
                                <TrendingUp className="h-4 w-4 text-emerald-400" />
                            )}
                            {changeType === "negative" && (
                                <TrendingDown className="h-4 w-4 text-red-400" />
                            )}
                            <span
                                className={`text-sm ${changeType === "positive"
                                    ? "text-emerald-400"
                                    : changeType === "negative"
                                        ? "text-red-400"
                                        : changeType === "warning"
                                            ? "text-amber-400"
                                            : "text-muted-foreground"
                                    }`}
                            >
                                {change}
                            </span>
                        </div>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${color} shadow-lg ${glowClass}`}>
                        <Icon className="h-6 w-6 text-foreground" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function DashboardPage() {
    const { data: session } = useSession();
    const locale = useNextIntlLocale();
    const t = useTranslations('Dashboard');
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState<{
        stats: DashboardStats;
        recentActivities: RecentActivity[];
        pendingApprovals: PendingApproval[];
    } | null>(null);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            const res = await fetch("/api/dashboard/stats");
            if (res.ok) {
                const data = await res.json();
                setDashboardData(data);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const stats = dashboardData?.stats ? [
        {
            title: t('totalEmployees'),
            value: formatNumber(dashboardData.stats.totalEmployees, locale),
            change: t('attendancePercent', { value: formatNumber(dashboardData.stats.attendancePercentage, locale) }),
            changeType: "positive" as const,
            Icon: Users,
            color: "from-blue-500 to-blue-600",
            glowClass: "icon-glow-blue"
        },
        {
            title: t('presentToday'),
            value: formatNumber(dashboardData.stats.presentToday, locale),
            change: `${formatNumber(dashboardData.stats.attendancePercentage, locale)}%`,
            changeType: "neutral" as const,
            Icon: UserCheck,
            color: "from-emerald-500 to-emerald-600",
            glowClass: "icon-glow-green"
        },
        {
            title: t('onLeave'),
            value: formatNumber(dashboardData.stats.onLeaveToday, locale),
            change: t('today'),
            changeType: "negative" as const,
            Icon: CalendarOff,
            color: "from-amber-500 to-amber-600",
            glowClass: "icon-glow-red"
        },
        {
            title: t('pendingRequests'),
            value: formatNumber(dashboardData.stats.pendingLeaves, locale),
            change: t('awaitingApproval'),
            changeType: "warning" as const,
            Icon: Clock,
            color: "from-purple-500 to-purple-600",
            glowClass: "icon-glow-orange"
        },
    ] : [];

    const recentActivities = dashboardData?.recentActivities || [];
    const pendingApprovals = dashboardData?.pendingApprovals || [];

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('goodMorning');
        if (hour < 17) return t('goodAfternoon');
        return t('goodEvening');
    };

    const userName = session?.user?.name || "Admin";

    // Events will be fetched from calendar/events API in future
    const upcomingEvents: { title: string; date: string; type: string }[] = [];

    const quickActions = [
        { label: t('markAttendance'), icon: Clock, color: "bg-blue-500/20 text-blue-400", href: "/attendance" },
        { label: t('applyLeave'), icon: CalendarOff, color: "bg-emerald-500/20 text-emerald-400", href: "/leaves/apply" },
        { label: t('runPayroll'), icon: Banknote, color: "bg-purple-500/20 text-purple-400", href: "/payroll" },
        { label: t('addEmployeeAction'), icon: Users, color: "bg-amber-500/20 text-amber-400", href: "/employees/new" },
        { label: t('viewReports'), icon: TrendingUp, color: "bg-cyan-500/20 text-cyan-400", href: "/reports" },
        { label: t('leavesAction'), icon: AlertCircle, color: "bg-pink-500/20 text-pink-400", href: "/leaves" },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Welcome Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{getGreeting()}, {userName}</h1>
                        <p className="text-muted-foreground mt-1">
                            {t('subtitle')}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/leaves/calendar">
                            <Button variant="outline" className="gap-2">
                                <Calendar className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('viewCalendar')}</span>
                            </Button>
                        </Link>
                        <Link href="/employees/new">
                            <Button className="gap-2">
                                <Users className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('addEmployee')}</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, index) => (
                        <div key={stat.title} className={`animate-card-enter animate-card-enter-${index + 1}`}>
                            <StatCard {...stat} />
                        </div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Activity */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>{t('recentActivity')}</CardTitle>
                                <Link href="/notifications">
                                    <Button variant="ghost" size="sm" className="gap-1">
                                        {t('viewAll')} <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {recentActivities.map((activity, index) => (
                                    <div key={index} className="flex items-start gap-4 p-3 rounded-xl hover:bg-hover transition-colors">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-xs">{activity.avatar}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-foreground">{activity.title}</p>
                                                <Badge variant="default">{activity.type}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-0.5 truncate">{activity.description}</p>
                                        </div>
                                        <span className="text-xs text-tertiary-foreground whitespace-nowrap">{activity.time}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Pending Approvals */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-amber-400" />
                                        {t('pendingApprovals')}
                                    </CardTitle>
                                    <Badge variant="warning" dot>{pendingApprovals.length}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {pendingApprovals.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-hover">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">{item.type} - {item.details}</p>
                                            </div>
                                            <Link href="/leaves/requests">
                                                <Button size="sm">{t('review') || 'Review'}</Button>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Upcoming Events */}
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('upcomingEvents')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {upcomingEvents.length > 0 ? (
                                    <div className="space-y-3">
                                        {upcomingEvents.map((event, index) => (
                                            <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-hover">
                                                <div className="h-10 w-10 rounded-lg bg-linear-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                                    <Calendar className="h-5 w-5 text-blue-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                                                    <p className="text-xs text-muted-foreground">{event.date}</p>
                                                </div>
                                                <Badge variant={event.type === "Holiday" ? "success" : event.type === "Training" ? "info" : "default"}>
                                                    {event.type}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <Calendar className="h-8 w-8 text-tertiary-foreground mx-auto mb-2" />
                                        <p className="text-sm text-muted-text">{t('noUpcomingEvents')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('quickActions')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                            {quickActions.map((action) => (
                                <Link key={action.label} href={action.href}>
                                    <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-hover hover:bg-card border border-card-border hover:border-border hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer">
                                        <div className={`h-12 w-12 rounded-xl ${action.color} flex items-center justify-center`}>
                                            <action.icon className="h-6 w-6" />
                                        </div>
                                        <span className="text-sm font-medium text-muted-foreground">{action.label}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
