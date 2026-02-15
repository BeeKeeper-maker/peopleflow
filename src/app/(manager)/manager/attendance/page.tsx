"use client";

import { useEffect, useState } from "react";
import {
    Clock,
    Calendar,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    XCircle,
    AlertCircle,
    TrendingUp,
    Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

interface TeamMemberAttendance {
    id: string;
    name: string;
    designation: string;
    avatar?: string;
    presentDays: number;
    absentDays: number;
    lateArrivals: number;
    avgCheckIn: string;
    avgWorkHours: string;
    todayStatus: "present" | "absent" | "late" | "on_leave" | "not_checked_in";
}

export default function ManagerAttendancePage() {
    const t = useTranslations("ManagerAttendance");
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [teamAttendance, setTeamAttendance] = useState<TeamMemberAttendance[]>([]);

    const monthName = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth() + 1;

                const empRes = await fetch("/api/employees");
                if (!empRes.ok) throw new Error("Failed to fetch employees");
                const empData = await empRes.json();
                const employees = empData.data || empData || [];

                const attRes = await fetch(`/api/attendance?year=${year}&month=${month}`);
                const attData = attRes.ok ? await attRes.json() : { data: [] };
                const attendanceRecords = attData.data || attData || [];

                const today = new Date().toISOString().split("T")[0];
                const workingDaysInMonth = getWorkingDaysInMonth(year, month);

                const teamData: TeamMemberAttendance[] = employees.map((emp: any) => {
                    const empAttendance = attendanceRecords.filter(
                        (a: any) => a.employeeId === emp.id
                    );

                    const presentDays = empAttendance.filter(
                        (a: any) => a.status === "PRESENT" || a.status === "LATE"
                    ).length;

                    const lateArrivals = empAttendance.filter(
                        (a: any) => a.status === "LATE"
                    ).length;

                    const absentDays = workingDaysInMonth - presentDays;

                    const checkInTimes = empAttendance
                        .filter((a: any) => a.checkIn)
                        .map((a: any) => new Date(a.checkIn).getHours() * 60 + new Date(a.checkIn).getMinutes());
                    const avgCheckInMins = checkInTimes.length > 0
                        ? Math.round(checkInTimes.reduce((a: number, b: number) => a + b, 0) / checkInTimes.length)
                        : 0;
                    const avgCheckIn = checkInTimes.length > 0
                        ? `${Math.floor(avgCheckInMins / 60)}:${String(avgCheckInMins % 60).padStart(2, "0")} ${avgCheckInMins >= 720 ? "PM" : "AM"}`
                        : "N/A";

                    const workMinutes = empAttendance
                        .filter((a: any) => a.checkIn && a.checkOut)
                        .map((a: any) => {
                            const checkIn = new Date(a.checkIn).getTime();
                            const checkOut = new Date(a.checkOut).getTime();
                            return (checkOut - checkIn) / (1000 * 60);
                        });
                    const avgWorkMins = workMinutes.length > 0
                        ? Math.round(workMinutes.reduce((a: number, b: number) => a + b, 0) / workMinutes.length)
                        : 0;
                    const avgWorkHours = workMinutes.length > 0
                        ? `${Math.floor(avgWorkMins / 60)}h ${avgWorkMins % 60}m`
                        : "N/A";

                    const todayRecord = empAttendance.find(
                        (a: any) => a.date?.split("T")[0] === today
                    );
                    let todayStatus: TeamMemberAttendance["todayStatus"] = "not_checked_in";
                    if (todayRecord) {
                        if (todayRecord.status === "PRESENT") todayStatus = "present";
                        else if (todayRecord.status === "LATE") todayStatus = "late";
                        else if (todayRecord.status === "ABSENT") todayStatus = "absent";
                        else if (todayRecord.status === "ON_LEAVE") todayStatus = "on_leave";
                    }

                    return {
                        id: emp.id,
                        name: `${emp.firstName} ${emp.lastName}`,
                        designation: emp.designation?.name || "N/A",
                        avatar: emp.avatar,
                        presentDays,
                        absentDays: absentDays > 0 ? absentDays : 0,
                        lateArrivals,
                        avgCheckIn,
                        avgWorkHours,
                        todayStatus,
                    };
                });

                setTeamAttendance(teamData);
            } catch (error) {
                console.error("Error fetching team attendance:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [currentMonth]);

    const getWorkingDaysInMonth = (year: number, month: number): number => {
        const daysInMonth = new Date(year, month, 0).getDate();
        let workingDays = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                workingDays++;
            }
        }
        const today = new Date();
        if (year === today.getFullYear() && month === today.getMonth() + 1) {
            const currentDay = today.getDate();
            let counted = 0;
            for (let day = 1; day <= currentDay; day++) {
                const date = new Date(year, month - 1, day);
                const dayOfWeek = date.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    counted++;
                }
            }
            return counted;
        }
        return workingDays;
    };

    const goToPreviousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "present":
                return (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t("present")}
                    </Badge>
                );
            case "absent":
                return (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        {t("absent")}
                    </Badge>
                );
            case "late":
                return (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        {t("late")}
                    </Badge>
                );
            case "on_leave":
                return (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        <Calendar className="h-3 w-3 mr-1" />
                        {t("onLeave")}
                    </Badge>
                );
            case "not_checked_in":
                return (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {t("notCheckedIn")}
                    </Badge>
                );
            default:
                return null;
        }
    };

    const teamStats = {
        presentToday: teamAttendance.filter((m) => m.todayStatus === "present" || m.todayStatus === "late").length,
        avgAttendance: teamAttendance.length > 0
            ? Math.round(
                (teamAttendance.reduce((acc, m) => acc + m.presentDays, 0) /
                    (teamAttendance.length * Math.max(1, teamAttendance[0]?.presentDays + teamAttendance[0]?.absentDays))) * 100
            )
            : 0,
        totalLateArrivals: teamAttendance.reduce((acc, m) => acc + m.lateArrivals, 0),
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
                    <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t("subtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToPreviousMonth}
                        className="border-card-border text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-4 py-2 bg-card rounded-lg text-foreground font-medium min-w-[160px] text-center">
                        {monthName}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToNextMonth}
                        className="border-card-border text-muted-foreground hover:text-foreground"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{teamStats.presentToday}</p>
                                <p className="text-xs text-muted-foreground">{t("presentToday")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{teamStats.avgAttendance || 0}%</p>
                                <p className="text-xs text-muted-foreground">{t("avgAttendance")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{teamStats.totalLateArrivals}</p>
                                <p className="text-xs text-muted-foreground">{t("lateArrivals")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Users className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{teamAttendance.length}</p>
                                <p className="text-xs text-muted-foreground">{t("teamMembers")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Team Attendance Table */}
            <Card className="bg-card border-card-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Users className="h-5 w-5 text-orange-400" />
                        {t("individualAttendance")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {teamAttendance.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-3 text-muted-text" />
                            <p>{t("noTeamMembers")}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-card-border">
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("employeeCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("todayCol")}</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">{t("presentCol")}</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">{t("absentCol")}</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">{t("lateCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("avgCheckInCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("avgHoursCol")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamAttendance.map((member) => (
                                        <tr
                                            key={member.id}
                                            className="border-b border-card-border hover:bg-hover"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={member.avatar} />
                                                        <AvatarFallback className="bg-linear-to-br from-orange-500 to-red-600 text-foreground text-xs">
                                                            {member.name[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground">{member.name}</p>
                                                        <p className="text-xs text-tertiary-foreground">{member.designation}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(member.todayStatus)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-green-400 font-medium">{member.presentDays}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-red-400 font-medium">{member.absentDays}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-yellow-400 font-medium">{member.lateArrivals}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{member.avgCheckIn}</td>
                                            <td className="px-4 py-3 text-sm text-foreground">{member.avgWorkHours}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
