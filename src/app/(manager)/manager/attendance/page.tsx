"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    AlertTriangle,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Filter,
    RefreshCw,
    Search,
    TrendingUp,
    Users,
    XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

import { useToast } from "@/components/ui/toast";
type AttendanceStatus = "present" | "absent" | "late" | "on_leave" | "not_checked_in" | "half_day";
type AttendanceFilter = "all" | "attention" | AttendanceStatus;

interface TeamEmployee {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode?: string;
    avatar?: string | null;
    photoUrl?: string | null;
    department?: { name: string } | null;
    designation?: { name: string } | null;
}

interface AttendanceRecord {
    id: string;
    employeeId: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    source: string | null;
}

interface TeamMemberAttendance {
    id: string;
    name: string;
    employeeCode: string;
    department: string;
    designation: string;
    avatar?: string | null;
    presentDays: number;
    absentDays: number;
    missingDays: number;
    lateArrivals: number;
    avgCheckIn: string;
    avgWorkHours: string;
    todayStatus: AttendanceStatus;
    todayCheckIn: string | null;
    todaySource: string | null;
    reliabilityScore: number;
}

const BD_OFFSET_MINUTES = 6 * 60;

function businessDateKey(date: Date) {
    const local = new Date(date.getTime() + BD_OFFSET_MINUTES * 60_000);
    return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function normalizeStatus(status: string | null | undefined): AttendanceStatus {
    const normalized = (status || "").toLowerCase().replace(/-/g, "_");
    if (normalized === "present") return "present";
    if (normalized === "late") return "late";
    if (normalized === "absent") return "absent";
    if (normalized === "on_leave") return "on_leave";
    if (normalized === "half_day") return "half_day";
    return "not_checked_in";
}

function csvEscape(value: unknown) {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function ManagerAttendancePage() {
    const t = useTranslations("ManagerAttendance");
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [teamAttendance, setTeamAttendance] = useState<TeamMemberAttendance[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<AttendanceFilter>("all");

    const monthName = new Intl.DateTimeFormat(dateLocale, { month: "long", year: "numeric" }).format(currentMonth);

    const getWorkingDaysInMonth = useCallback((year: number, month: number): number => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const todayKey = businessDateKey(new Date());
        let workingDays = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(Date.UTC(year, month - 1, day));
            const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            if (dateKey > todayKey) break;

            const dayOfWeek = date.getUTCDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
        }

        return workingDays;
    }, []);

    const formatTime = useCallback((value: string | null) => {
        if (!value) return "—";
        return new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
    }, [dateLocale]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth() + 1;

            const empRes = await fetch("/api/manager/team");
            if (!empRes.ok) throw new Error("Failed to fetch employees");
            const empData = await empRes.json();
            const employees: TeamEmployee[] = empData.data || empData || [];

            const attRes = await fetch(`/api/attendance?year=${year}&month=${month}&limit=1000`);
            const attData = attRes.ok ? await attRes.json() : [];
            const attendanceRecords: AttendanceRecord[] = Array.isArray(attData) ? attData : attData.data || [];

            const today = businessDateKey(new Date());
            const workingDaysInMonth = getWorkingDaysInMonth(year, month);

            const teamData = employees.map((emp) => {
                const empAttendance = attendanceRecords.filter((record) => record.employeeId === emp.id);
                const normalizedRecords = empAttendance.map((record) => ({ ...record, normalizedStatus: normalizeStatus(record.status) }));

                const presentDays = normalizedRecords.filter((record) => ["present", "late", "half_day"].includes(record.normalizedStatus)).length;
                const absentDays = normalizedRecords.filter((record) => record.normalizedStatus === "absent").length;
                const lateArrivals = normalizedRecords.filter((record) => record.normalizedStatus === "late").length;
                const accountedDays = new Set(normalizedRecords.map((record) => businessDateKey(new Date(record.date)))).size;
                const missingDays = Math.max(0, workingDaysInMonth - accountedDays);

                const checkInTimes = normalizedRecords
                    .filter((record) => record.checkIn)
                    .map((record) => {
                        const checkIn = new Date(record.checkIn as string);
                        return checkIn.getHours() * 60 + checkIn.getMinutes();
                    });
                const avgCheckInMins = checkInTimes.length
                    ? Math.round(checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length)
                    : null;
                const avgCheckIn = avgCheckInMins !== null
                    ? `${String(Math.floor(avgCheckInMins / 60)).padStart(2, "0")}:${String(avgCheckInMins % 60).padStart(2, "0")}`
                    : "—";

                const workMinutes = normalizedRecords
                    .filter((record) => record.checkIn && record.checkOut)
                    .map((record) => {
                        const checkIn = new Date(record.checkIn as string).getTime();
                        const checkOut = new Date(record.checkOut as string).getTime();
                        return Math.max(0, (checkOut - checkIn) / 60000);
                    });
                const avgWorkMins = workMinutes.length
                    ? Math.round(workMinutes.reduce((a, b) => a + b, 0) / workMinutes.length)
                    : null;
                const avgWorkHours = avgWorkMins !== null
                    ? `${Math.floor(avgWorkMins / 60)}h ${avgWorkMins % 60}m`
                    : "—";

                const todayRecord = normalizedRecords.find((record) => businessDateKey(new Date(record.date)) === today);
                const todayStatus = todayRecord?.normalizedStatus || "not_checked_in";
                const denominator = Math.max(1, workingDaysInMonth);
                const reliabilityScore = Math.max(0, Math.round(((presentDays - lateArrivals * 0.25 - missingDays * 0.5) / denominator) * 100));

                return {
                    id: emp.id,
                    name: `${emp.firstName} ${emp.lastName}`,
                    employeeCode: emp.employeeCode || "—",
                    department: emp.department?.name || t("noDepartment"),
                    designation: emp.designation?.name || t("noDesignation"),
                    avatar: emp.avatar || emp.photoUrl || null,
                    presentDays,
                    absentDays,
                    missingDays,
                    lateArrivals,
                    avgCheckIn,
                    avgWorkHours,
                    todayStatus,
                    todayCheckIn: todayRecord?.checkIn || null,
                    todaySource: todayRecord?.source || null,
                    reliabilityScore,
                } satisfies TeamMemberAttendance;
            });

            setTeamAttendance(teamData);
        } catch (error) {
            console.error("Error fetching team attendance:", error);
                addToast({ title: "Failed to load data. Please refresh the page.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }, [currentMonth, getWorkingDaysInMonth, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const goToPreviousMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const goToNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const isAttentionStatus = (member: TeamMemberAttendance) => ["absent", "late", "not_checked_in", "half_day"].includes(member.todayStatus) || member.missingDays > 0;

    const filteredTeamAttendance = useMemo(() => {
        const q = search.trim().toLowerCase();
        return teamAttendance.filter((member) => {
            if (statusFilter === "attention" && !isAttentionStatus(member)) return false;
            if (statusFilter !== "all" && statusFilter !== "attention" && member.todayStatus !== statusFilter) return false;
            if (!q) return true;
            return `${member.name} ${member.employeeCode} ${member.department} ${member.designation}`.toLowerCase().includes(q);
        });
    }, [search, statusFilter, teamAttendance]);

    const teamStats = useMemo(() => ({
        presentToday: teamAttendance.filter((member) => member.todayStatus === "present" || member.todayStatus === "late" || member.todayStatus === "half_day").length,
        attentionToday: teamAttendance.filter(isAttentionStatus).length,
        avgAttendance: teamAttendance.length
            ? Math.round(teamAttendance.reduce((acc, member) => acc + member.reliabilityScore, 0) / teamAttendance.length)
            : 0,
        totalLateArrivals: teamAttendance.reduce((acc, member) => acc + member.lateArrivals, 0),
        teamMembers: teamAttendance.length,
    }), [teamAttendance]);

    const getStatusBadge = (status: AttendanceStatus) => {
        const config = {
            present: { label: t("present"), icon: CheckCircle2, className: "bg-green-500/20 text-green-400 border-green-500/30" },
            absent: { label: t("absent"), icon: XCircle, className: "bg-red-500/20 text-red-400 border-red-500/30" },
            late: { label: t("late"), icon: Clock, className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
            half_day: { label: t("halfDay"), icon: AlertTriangle, className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
            on_leave: { label: t("onLeave"), icon: Calendar, className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
            not_checked_in: { label: t("notCheckedIn"), icon: AlertCircle, className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
        }[status];

        const Icon = config.icon;
        return (
            <Badge className={cn("gap-1", config.className)}>
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>
        );
    };

    const exportCsv = () => {
        const header = ["Employee Code", "Name", "Department", "Designation", "Today Status", "Today Check In", "Source", "Present Days", "Absent Days", "Missing Days", "Late Arrivals", "Avg Check In", "Avg Work Hours", "Reliability"];
        const rows = filteredTeamAttendance.map((member) => [
            member.employeeCode,
            member.name,
            member.department,
            member.designation,
            member.todayStatus,
            member.todayCheckIn ? formatTime(member.todayCheckIn) : "",
            member.todaySource || "",
            member.presentDays,
            member.absentDays,
            member.missingDays,
            member.lateArrivals,
            member.avgCheckIn,
            member.avgWorkHours,
            `${member.reliabilityScore}%`,
        ].map(csvEscape).join(","));

        const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `team-attendance-${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1 max-w-3xl">{t("subtitle")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="border-card-border text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-4 py-2 bg-card rounded-lg text-foreground font-medium min-w-[170px] text-center">{monthName}</span>
                    <Button variant="outline" size="icon" onClick={goToNextMonth} className="border-card-border text-muted-foreground hover:text-foreground">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={fetchData} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        {t("refresh")}
                    </Button>
                </div>
            </div>

            <Card className="bg-linear-to-r from-amber-500/10 via-card to-card border-amber-500/20">
                <CardContent className="p-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                            {t("managerPurposeTitle")}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">{t("managerPurposeDesc")}</p>
                    </div>
                    <Button onClick={() => setStatusFilter("attention")} className="gap-2 self-start lg:self-auto">
                        <Filter className="h-4 w-4" />
                        {t("showAttentionOnly")}
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: t("presentToday"), value: teamStats.presentToday, icon: CheckCircle2, tone: "bg-green-500/20 text-green-400" },
                    { label: t("needsAttention"), value: teamStats.attentionToday, icon: AlertTriangle, tone: "bg-amber-500/20 text-amber-400" },
                    { label: t("avgAttendance"), value: `${teamStats.avgAttendance}%`, icon: TrendingUp, tone: "bg-blue-500/20 text-blue-400" },
                    { label: t("lateArrivals"), value: teamStats.totalLateArrivals, icon: Clock, tone: "bg-yellow-500/20 text-yellow-400" },
                    { label: t("teamMembers"), value: teamStats.teamMembers, icon: Users, tone: "bg-purple-500/20 text-purple-400" },
                ].map((item) => {
                    const Icon = item.icon;
                    return (
                        <Card key={item.label} className="bg-card border-card-border">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", item.tone)}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-display font-bold tabular-nums text-foreground">{item.value}</p>
                                        <p className="text-xs text-muted-foreground">{item.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card className="bg-card border-card-border">
                <CardContent className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative flex-1 lg:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchTeamAttendance")} className="pl-9" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {(["all", "attention", "present", "late", "absent", "not_checked_in", "on_leave"] as AttendanceFilter[]).map((value) => (
                            <Button key={value} variant={statusFilter === value ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(value)}>
                                {value === "all" ? t("filterAll") : value === "attention" ? t("attention") : getStatusBadge(value as AttendanceStatus)}
                            </Button>
                        ))}
                        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
                            <Download className="h-4 w-4" />
                            {t("exportCsv")}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card border-card-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Users className="h-5 w-5 text-orange-400" />
                        {t("individualAttendance")}
                    </CardTitle>
                    <CardDescription>{t("individualAttendanceDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredTeamAttendance.length === 0 ? (
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
                                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">{t("missingCol")}</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">{t("lateCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("avgCheckInCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("avgHoursCol")}</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">{t("reliabilityCol")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTeamAttendance.map((member) => (
                                        <tr key={member.id} className="border-b border-card-border hover:bg-hover">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={member.avatar || undefined} />
                                                        <AvatarFallback className="bg-linear-to-br from-orange-500 to-red-600 text-white text-xs">
                                                            {member.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground">{member.name}</p>
                                                        <p className="text-xs text-tertiary-foreground">{member.employeeCode} · {member.designation}</p>
                                                        <p className="text-xs text-muted-foreground">{member.department}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    {getStatusBadge(member.todayStatus)}
                                                    {member.todayCheckIn && <p className="text-xs text-muted-foreground">{formatTime(member.todayCheckIn)} {member.todaySource ? `· ${member.todaySource}` : ""}</p>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center"><span className="text-green-400 font-medium">{member.presentDays}</span></td>
                                            <td className="px-4 py-3 text-center"><span className={cn("font-medium", member.missingDays > 0 ? "text-red-400" : "text-muted-foreground")}>{member.missingDays}</span></td>
                                            <td className="px-4 py-3 text-center"><span className={cn("font-medium", member.lateArrivals > 0 ? "text-yellow-400" : "text-muted-foreground")}>{member.lateArrivals}</span></td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{member.avgCheckIn}</td>
                                            <td className="px-4 py-3 text-sm text-foreground">{member.avgWorkHours}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Badge className={cn("border-0", member.reliabilityScore >= 90 ? "bg-emerald-500/20 text-emerald-400" : member.reliabilityScore >= 70 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400")}>{member.reliabilityScore}%</Badge>
                                            </td>
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
