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
                        description: `${l.leaveType?.name || "Leave"} - ${l.totalDays} দিন`,
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
                return <CheckCircle2 className="h-4 w-4 text-green-400" />;
            case "absent":
                return <XCircle className="h-4 w-4 text-red-400" />;
            case "late":
                return <AlertCircle className="h-4 w-4 text-yellow-400" />;
            case "on_leave":
                return <Calendar className="h-4 w-4 text-blue-400" />;
            default:
                return <Clock className="h-4 w-4 text-gray-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "present":
                return "bg-green-500/20 text-green-400 border-green-500/30";
            case "absent":
                return "bg-red-500/20 text-red-400 border-red-500/30";
            case "late":
                return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
            case "on_leave":
                return "bg-blue-500/20 text-blue-400 border-blue-500/30";
            default:
                return "bg-gray-500/20 text-gray-400 border-gray-500/30";
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
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">
                        {getGreeting()}, {firstName}! 👋
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {t('subtitle')}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link href="/manager/approvals">
                        <Button className="bg-blue-600 hover:bg-blue-500">
                            <CheckSquare className="h-4 w-4 mr-2" />
                            {t('approvalsBtn')} ({pendingApprovals.length})
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Team Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <Users className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-display font-bold text-foreground">{teamStats.total}</p>
                                <p className="text-xs text-muted-foreground">{t('totalTeam')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-display font-bold text-green-400">{teamStats.present}</p>
                                <p className="text-xs text-muted-foreground">{t('present')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                <XCircle className="h-5 w-5 text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-display font-bold text-red-400">{teamStats.absent}</p>
                                <p className="text-xs text-muted-foreground">{t('absent')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-display font-bold text-blue-400">{teamStats.onLeave}</p>
                                <p className="text-xs text-muted-foreground">{t('onLeave')}</p>
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
                            <CardTitle className="text-foreground text-lg">{t('teamStatus')}</CardTitle>
                            <Link href="/manager/team">
                                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                                    View All
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
                            <div className="space-y-3">
                                {teamMembers.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-hover"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={member.photoUrl} />
                                                <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-foreground">
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
                                        <Badge className={getStatusColor(attendanceMap[member.id] || "none")}>
                                            {getStatusIcon(attendanceMap[member.id] || "none")}
                                            <span className="ml-1 capitalize">
                                                {(attendanceMap[member.id] || "Not Checked In").replace("_", " ")}
                                            </span>
                                        </Badge>
                                    </div>
                                ))}
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
                                <CardTitle className="text-foreground text-lg">{t('pendingApprovals')}</CardTitle>
                                <Link href="/manager/approvals">
                                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                                        View All
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
                            <CardTitle className="text-foreground text-lg">{t('upcomingEvents')}</CardTitle>
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
