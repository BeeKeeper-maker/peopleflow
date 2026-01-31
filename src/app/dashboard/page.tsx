"use client";

import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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

// Stat Card - Pure presentation
function StatCard({
    title,
    value,
    change,
    changeType,
    Icon,
    color
}: {
    title: string;
    value: string;
    change: string;
    changeType: "positive" | "negative" | "neutral" | "warning";
    Icon: LucideIcon;
    color: string;
}) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-white/60">{title}</p>
                        <p className="text-3xl font-bold text-white mt-2">{value}</p>
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
                                            : "text-white/60"
                                    }`}
                            >
                                {change}
                            </span>
                        </div>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function DashboardPage() {
    const stats = [
        { title: "Total Employees", value: "247", change: "+12%", changeType: "positive" as const, Icon: Users, color: "from-blue-500 to-blue-600" },
        { title: "Present Today", value: "218", change: "88.3%", changeType: "neutral" as const, Icon: UserCheck, color: "from-emerald-500 to-emerald-600" },
        { title: "On Leave", value: "12", change: "-3", changeType: "negative" as const, Icon: CalendarOff, color: "from-amber-500 to-amber-600" },
        { title: "Pending Requests", value: "8", change: "3 urgent", changeType: "warning" as const, Icon: Clock, color: "from-purple-500 to-purple-600" },
    ];

    const recentActivities = [
        { type: "leave", title: "Leave Request", description: "Ahmad Hossain requested 3 days casual leave", time: "5 min ago", avatar: "AH" },
        { type: "attendance", title: "Late Check-in", description: "Fatima Rahman checked in at 10:15 AM", time: "15 min ago", avatar: "FR" },
        { type: "payroll", title: "Salary Processed", description: "January 2026 payroll has been processed", time: "1 hour ago", avatar: "SY" },
        { type: "employee", title: "New Employee", description: "Karim Uddin has joined Engineering team", time: "2 hours ago", avatar: "KU" },
    ];

    const upcomingEvents = [
        { title: "Eid-ul-Fitr", date: "Mar 31 - Apr 2", type: "Holiday" },
        { title: "Q1 Performance Review", date: "Apr 1 - Apr 15", type: "Event" },
        { title: "Training: Leadership Skills", date: "Apr 5", type: "Training" },
    ];

    const pendingApprovals = [
        { name: "Ahmad Hossain", type: "Leave Request", days: "3 days" },
        { name: "Fatima Rahman", type: "Salary Advance", days: "BDT 50,000" },
        { name: "Karim Uddin", type: "Leave Request", days: "5 days" },
    ];

    const quickActions = [
        { label: "Mark Attendance", icon: Clock, color: "bg-blue-500/20 text-blue-400", href: "/attendance" },
        { label: "Apply Leave", icon: CalendarOff, color: "bg-emerald-500/20 text-emerald-400", href: "/leaves/apply" },
        { label: "Run Payroll", icon: Banknote, color: "bg-purple-500/20 text-purple-400", href: "/payroll" },
        { label: "Add Employee", icon: Users, color: "bg-amber-500/20 text-amber-400", href: "/employees/new" },
        { label: "View Reports", icon: TrendingUp, color: "bg-cyan-500/20 text-cyan-400", href: "/reports" },
        { label: "Leaves", icon: AlertCircle, color: "bg-pink-500/20 text-pink-400", href: "/leaves" },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Welcome Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Good Morning, Admin</h1>
                        <p className="text-white/60 mt-1">
                            Here&apos;s what&apos;s happening in your organization today.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/leaves/calendar">
                            <Button variant="outline" className="gap-2">
                                <Calendar className="h-4 w-4" />
                                <span className="hidden sm:inline">View Calendar</span>
                            </Button>
                        </Link>
                        <Link href="/employees/new">
                            <Button className="gap-2">
                                <Users className="h-4 w-4" />
                                <span className="hidden sm:inline">Add Employee</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat) => (
                        <StatCard key={stat.title} {...stat} />
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Activity */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Recent Activity</CardTitle>
                                <Link href="/notifications">
                                    <Button variant="ghost" size="sm" className="gap-1">
                                        View All <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {recentActivities.map((activity, index) => (
                                    <div key={index} className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-xs">{activity.avatar}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-white">{activity.title}</p>
                                                <Badge variant="default">{activity.type}</Badge>
                                            </div>
                                            <p className="text-sm text-white/60 mt-0.5 truncate">{activity.description}</p>
                                        </div>
                                        <span className="text-xs text-white/40 whitespace-nowrap">{activity.time}</span>
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
                                        Pending Approvals
                                    </CardTitle>
                                    <Badge variant="warning" dot>{pendingApprovals.length}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {pendingApprovals.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                            <div>
                                                <p className="text-sm font-medium text-white">{item.name}</p>
                                                <p className="text-xs text-white/60">{item.type} - {item.days}</p>
                                            </div>
                                            <Link href="/leaves/requests">
                                                <Button size="sm">Review</Button>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Upcoming Events */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Upcoming Events</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {upcomingEvents.map((event, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                                <Calendar className="h-5 w-5 text-blue-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{event.title}</p>
                                                <p className="text-xs text-white/60">{event.date}</p>
                                            </div>
                                            <Badge variant={event.type === "Holiday" ? "success" : event.type === "Training" ? "info" : "default"}>
                                                {event.type}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                            {quickActions.map((action) => (
                                <Link key={action.label} href={action.href}>
                                    <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer">
                                        <div className={`h-12 w-12 rounded-xl ${action.color} flex items-center justify-center`}>
                                            <action.icon className="h-6 w-6" />
                                        </div>
                                        <span className="text-sm font-medium text-white/80">{action.label}</span>
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
