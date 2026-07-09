"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Users,
    Calendar,
    Clock,
    CheckSquare,
    Target,
    ChevronRight,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Cake,
    Gift,
    Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/ui/toast";
interface TeamMember {
    id: string;
    firstName: string;
    lastName: string;
    designation?: { name: string };
    photoUrl?: string;
    status?: string;
}

interface PendingApproval {
    id: string;
    type: "leave" | "expense";
    employeeName: string;
    description: string;
    date: string;
}

interface UpcomingEvent {
    id: string;
    type: "birthday" | "anniversary";
    employeeName: string;
    date: string;
}

export default function ManagerDashboardPage() {
    const { addToast } = useToast();
    const { data: session } = useSession();
    const t = useTranslations('Manager');
    const [isLoading, setIsLoading] = useState(true);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
    const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
    const [teamStats, setTeamStats] = useState({
        total: 0,
        present: 0,
        absent: 0,
        onLeave: 0,
    });

    const user = session?.user;
    const firstName = user?.name?.split(" ")[0] || "Manager";

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
                // Fetch employees
                const employeesRes = await fetch("/api/manager/team");
                if (employeesRes.ok) {
                    const data = await employeesRes.json();
                    const employees = data.data || data || [];
                    setTeamMembers(employees.slice(0, 5)); // Show top 5

                    // Fetch today's attendance
                    const today = new Date().toISOString().split("T")[0];
                    const attendanceRes = await fetch(`/api/attendance?date=${today}`);
                    if (attendanceRes.ok) {
                        const attData = await attendanceRes.json();
                        const records = attData.data || attData || [];
                        const statusMap: Record<string, string> = {};
                        let present = 0, absent = 0, onLeave = 0, late = 0;

                        records.forEach((r: { employeeId: string; status: string }) => {
                            statusMap[r.employeeId] = r.status || "present";
                            switch (r.status) {
                                case "present": present++; break;
                                case "absent": absent++; break;
                                case "on_leave": onLeave++; break;
                                case "late": late++; break;
                            }
                        });

                        setAttendanceMap(statusMap);
                        setTeamStats({
                            total: employees.length,
                            present,
                            absent,
                            onLeave,
                        });
                    } else {
                        setTeamStats({
                            total: employees.length,
                            present: 0,
                            absent: 0,
                            onLeave: 0,
                        });
                    }

                    // Calculate upcoming birthdays/anniversaries from already-fetched employees
                    const todayDate = new Date();
                    const upcomingList: UpcomingEvent[] = [];

                    employees.forEach((emp: {
                        id: string;
                        firstName: string;
                        lastName: string;
                        dateOfBirth?: string;
                        joiningDate?: string;
                    }) => {
                        // Check birthday
                        if (emp.dateOfBirth) {
                            const dob = new Date(emp.dateOfBirth);
                            const thisYearBirthday = new Date(todayDate.getFullYear(), dob.getMonth(), dob.getDate());
                            const daysUntil = Math.ceil((thisYearBirthday.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysUntil >= 0 && daysUntil <= 30) {
                                upcomingList.push({
                                    id: `bday-${emp.id}`,
                                    type: "birthday",
                                    employeeName: `${emp.firstName} ${emp.lastName}`,
                                    date: thisYearBirthday.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                                });
                            }
                        }

                        // Check work anniversary
                        if (emp.joiningDate) {
                            const jd = new Date(emp.joiningDate);
                            const thisYearAnniversary = new Date(todayDate.getFullYear(), jd.getMonth(), jd.getDate());
                            const daysUntil = Math.ceil((thisYearAnniversary.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysUntil >= 0 && daysUntil <= 30 && jd.getFullYear() < todayDate.getFullYear()) {
                                upcomingList.push({
                                    id: `anniv-${emp.id}`,
                                    type: "anniversary",
                                    employeeName: `${emp.firstName} ${emp.lastName}`,
                                    date: thisYearAnniversary.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                                });
                            }
                        }
                    });

                    setUpcomingEvents(upcomingList.slice(0, 5));
                }

                // Fetch pending leave applications
                const leavesRes = await fetch("/api/leaves/applications?status=pending");
                if (leavesRes.ok) {
                    const leavesData = await leavesRes.json();
                    const leaves = leavesData.data || leavesData || [];
                    const leaveApprovals = leaves.map((l: {
                        id: string;
                        employee: { firstName: string; lastName: string };
                        leaveType: { name: string };
                        totalDays: number;
                        fromDate: string;
                        toDate: string;
                    }) => ({
                        id: l.id,
                        type: "leave" as const,
                        employeeName: `${l.employee?.firstName || ""} ${l.employee?.lastName || ""}`,
                        description: `${l.leaveType?.name || "Leave"} - ${l.totalDays} day${l.totalDays !== 1 ? 's' : ''}`,
                        date: `${new Date(l.fromDate).toLocaleDateString()} - ${new Date(l.toDate).toLocaleDateString()}`,
                    }));
                    setPendingApprovals(leaveApprovals);
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
                addToast({ title: "Failed to load data. Please refresh the page.", type: "error" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "present":
                return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
            case "absent":
                return <XCircle className="h-4 w-4 text-red-400" />;
            case "late":
                return <AlertCircle className="h-4 w-4 text-amber-400" />;
            case "on_leave":
                return <Calendar className="h-4 w-4 text-blue-400" />;
            default:
                return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "present":
                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
            case "absent":
                return "bg-red-500/15 text-red-400 border-red-500/20";
            case "late":
                return "bg-amber-500/15 text-amber-400 border-amber-500/20";
            case "on_leave":
                return "bg-blue-500/15 text-blue-400 border-blue-500/20";
            default:
                return "bg-muted/15 text-muted-foreground border-card-border";
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 ring-1 ring-blue-500/20">
                        <Sparkles className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">
                            {getGreeting()}, {firstName}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link href="/manager/approvals">
                        <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20">
                            <CheckSquare className="h-4 w-4 mr-2" />
                            {t('approvalsBtn')} ({pendingApprovals.length})
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Team Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border border-blue-500/20 bg-card overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{t('totalTeam')}</p>
                                <p className="text-2xl font-display font-bold tabular-nums text-foreground mt-1">{teamStats.total}</p>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                                <Users className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-card overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{t('present')}</p>
                                <p className="text-2xl font-display font-bold tabular-nums text-emerald-400 mt-1">{teamStats.present}</p>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-red-500/20 bg-card overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{t('absent')}</p>
                                <p className="text-2xl font-display font-bold tabular-nums text-red-400 mt-1">{teamStats.absent}</p>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                                <XCircle className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-purple-500/20 bg-card overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{t('onLeave')}</p>
                                <p className="text-2xl font-display font-bold tabular-nums text-purple-400 mt-1">{teamStats.onLeave}</p>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
                                <Calendar className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Team Status */}
                <Card className="bg-card border-card-border lg:col-span-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-foreground text-lg flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-400" />
                                {t('teamStatus')}
                            </CardTitle>
                            <Link href="/manager/team">
                                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                                    {t('viewAll')}
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {teamMembers.length === 0 ? (
                            <div className="text-center py-8">
                                <Users className="h-10 w-10 mx-auto text-muted-text mb-3" />
                                <p className="text-tertiary-foreground">{t('noTeamMembers')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {teamMembers.map((member) => {
                                    const status = attendanceMap[member.id] || "none";
                                    return (
                                        <div
                                            key={member.id}
                                            className="flex items-center justify-between p-3 rounded-lg bg-hover hover:bg-card hover:border-card-border border border-transparent transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={member.photoUrl} />
                                                    <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-white">
                                                        {member.firstName[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-foreground">
                                                        {member.firstName} {member.lastName}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {member.designation?.name || t('noDesignation')}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge className={`${getStatusColor(status)} border`}>
                                                {getStatusIcon(status)}
                                                <span className="ml-1 capitalize">
                                                    {status === "none" ? t('notCheckedIn') : status.replace("_", " ")}
                                                </span>
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Side Panel */}
                <div className="space-y-6">
                    {/* Pending Approvals */}
                    <Card className="bg-card border-card-border">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-amber-400" />
                                    {t('pendingApprovals')}
                                </CardTitle>
                                <Link href="/manager/approvals">
                                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                                        {t('viewAll')}
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {pendingApprovals.length === 0 ? (
                                <div className="text-center py-6">
                                    <CheckSquare className="h-8 w-8 mx-auto text-muted-text mb-2" />
                                    <p className="text-sm text-tertiary-foreground">{t('noPendingApprovals')}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingApprovals.slice(0, 3).map((approval) => (
                                        <div
                                            key={approval.id}
                                            className="p-3 rounded-lg bg-hover"
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                {approval.type === "leave" ? (
                                                    <Calendar className="h-4 w-4 text-blue-400" />
                                                ) : (
                                                    <Target className="h-4 w-4 text-green-400" />
                                                )}
                                                <p className="text-sm font-medium text-foreground">
                                                    {approval.employeeName}
                                                </p>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{approval.description}</p>
                                            <p className="text-xs text-tertiary-foreground mt-1">{approval.date}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Upcoming Events */}
                    <Card className="bg-card border-card-border">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-foreground text-lg flex items-center gap-2">
                                <Gift className="h-4 w-4 text-pink-400" />
                                {t('upcomingEvents')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {upcomingEvents.length === 0 ? (
                                <div className="text-center py-6">
                                    <Cake className="h-8 w-8 mx-auto text-muted-text mb-2" />
                                    <p className="text-sm text-tertiary-foreground">{t('noUpcomingEvents')}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {upcomingEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-hover"
                                        >
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center ${event.type === "birthday"
                                                    ? "bg-pink-500/20"
                                                    : "bg-purple-500/20"
                                                    }`}
                                            >
                                                {event.type === "birthday" ? (
                                                    <Cake className="h-4 w-4 text-pink-400" />
                                                ) : (
                                                    <Gift className="h-4 w-4 text-purple-400" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    {event.employeeName}
                                                </p>
                                                <p className="text-xs text-tertiary-foreground">
                                                    {event.type === "birthday" ? t('birthday') : t('workAnniversary')} • {event.date}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
