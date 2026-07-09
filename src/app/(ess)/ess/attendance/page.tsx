"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Calendar,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";

import { useEssAttendance } from "@/hooks/use-data";

interface AttendanceRecord {
    id: string;
    date: string;
    dayOfWeek: string;
    status: "present" | "absent" | "half_day" | "on_leave" | "late" | "weekend" | "holiday" | "upcoming" | "not_marked";
    checkIn?: string;
    checkOut?: string;
    workingHours?: string;
    lateMinutes?: number;
    earlyLeaveMinutes?: number;
    overtime?: string;
}

interface MonthlyStats {
    present: number;
    absent: number;
    halfDay: number;
    onLeave: number;
    late: number;
    earlyLeave: number;
    totalWorkingHours: string;
    averageCheckIn: string;
}

export default function ESSAttendancePage() {
    const t = useTranslations("ESSAttendance");
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthName = new Intl.DateTimeFormat(dateLocale, { month: "long", year: "numeric" }).format(currentMonth);

    const formatLocalDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const formatTime = useCallback((value: string | Date) => new Intl.DateTimeFormat(dateLocale, {
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value)), [dateLocale]);

    const formatTableDate = (dateKey: string) => new Intl.DateTimeFormat(dateLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(`${dateKey}T00:00:00`));

    const formatDuration = useCallback((minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return locale.startsWith("bn") ? `${hours}ঘ ${mins}মি` : `${hours}h ${mins}m`;
    }, [locale]);

    // ── TanStack Query: attendance records for the selected month ──
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const { data: rawRecords = [], isLoading } = useEssAttendance({ year, month });

    // ── Transform API data to UI format (fill in all days of the month) ──
    // Memoized — recomputes only when the cached records or locale change.
    const { records, stats } = useMemo(() => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const today = new Date();
        const transformedRecords: AttendanceRecord[] = [];

        // Create a map of existing records by date
        const recordMap = new Map<string, AttendanceRecord>();
        (rawRecords as Array<{
            id: string;
            date: string;
            status?: string;
            checkInTime?: string;
            checkOutTime?: string;
            totalMinutes?: number;
            lateMinutes?: number;
            earlyLeaveMinutes?: number;
            overtimeMinutes?: number;
        }>).forEach((r) => {
            const dateStr = r.date.split("T")[0];
            recordMap.set(dateStr, {
                id: r.id,
                date: dateStr,
                dayOfWeek: new Intl.DateTimeFormat(dateLocale, { weekday: "long" }).format(new Date(r.date)),
                status: (r.status as AttendanceRecord["status"]) || "present",
                checkIn: r.checkInTime ? formatTime(r.checkInTime) : undefined,
                checkOut: r.checkOutTime ? formatTime(r.checkOutTime) : undefined,
                workingHours: r.totalMinutes ? formatDuration(r.totalMinutes) : undefined,
                lateMinutes: r.lateMinutes,
                earlyLeaveMinutes: r.earlyLeaveMinutes,
                overtime: r.overtimeMinutes ? formatDuration(r.overtimeMinutes) : undefined,
            });
        });

        // Fill in all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dateStr = formatLocalDateKey(date);
            const dayOfWeek = new Intl.DateTimeFormat(dateLocale, { weekday: "long" }).format(date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isFuture = startOfLocalDay(date) > startOfLocalDay(today);
            const isToday = startOfLocalDay(date).getTime() === startOfLocalDay(today).getTime();

            if (recordMap.has(dateStr)) {
                transformedRecords.push(recordMap.get(dateStr)!);
            } else {
                transformedRecords.push({
                    id: `placeholder-${dateStr}`,
                    date: dateStr,
                    dayOfWeek,
                    status: isFuture ? "upcoming" : (isWeekend ? "weekend" : (isToday ? "not_marked" : "absent")),
                });
            }
        }

        transformedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Calculate stats from raw API records
        const presentCount = (rawRecords as Array<{ status?: string }>).filter((r) => r.status === "present").length;
        const absentCount = (rawRecords as Array<{ status?: string }>).filter((r) => r.status === "absent").length;
        const lateCount = (rawRecords as Array<{ status?: string }>).filter((r) => r.status === "late").length;
        const onLeaveCount = (rawRecords as Array<{ status?: string }>).filter((r) => r.status === "on_leave").length;
        const halfDayCount = (rawRecords as Array<{ status?: string }>).filter((r) => r.status === "half_day").length;

        const totalMinutes = (rawRecords as Array<{ totalMinutes?: number }>).reduce((acc, r) => acc + (r.totalMinutes || 0), 0);
        // Calculate average check-in from actual records
        const checkInTimes = (rawRecords as Array<{ checkInTime?: string }>)
            .filter((r) => r.checkInTime)
            .map((r) => new Date(r.checkInTime as string));
        let avgCheckIn = t("notAvailable");
        if (checkInTimes.length > 0) {
            const avgMs = checkInTimes.reduce((sum, d) => {
                const dayStart = new Date(d);
                dayStart.setHours(0, 0, 0, 0);
                return sum + (d.getTime() - dayStart.getTime());
            }, 0) / checkInTimes.length;
            const avgDate = new Date();
            avgDate.setHours(0, 0, 0, 0);
            avgDate.setMilliseconds(avgMs);
            avgCheckIn = formatTime(avgDate);
        }

        const computedStats: MonthlyStats = {
            present: presentCount,
            absent: absentCount,
            halfDay: halfDayCount,
            onLeave: onLeaveCount,
            late: lateCount,
            earlyLeave: 0,
            totalWorkingHours: formatDuration(totalMinutes),
            averageCheckIn: avgCheckIn,
        };

        return { records: transformedRecords, stats: computedStats };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawRecords, year, month, dateLocale, formatTime, formatDuration]);

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
            case "half_day":
                return (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {t("halfDay")}
                    </Badge>
                );
            case "late":
                return (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
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
            case "weekend":
                return (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                        {t("weekend")}
                    </Badge>
                );
            case "holiday":
                return (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        {t("holiday")}
                    </Badge>
                );
            case "upcoming":
                return (
                    <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/20">
                        {t("upcoming")}
                    </Badge>
                );
            case "not_marked":
                return (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25">
                        <Clock className="h-3 w-3 mr-1" />
                        {t("notMarkedYet")}
                    </Badge>
                );
            default:
                return null;
        }
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
            <PageHeader
                title={t("title")}
                subtitle={t("subtitle")}
                icon={Clock}
                iconColor="blue"
                actions={
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
                }
            />

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-card border-card-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-display font-bold text-foreground tabular-nums">{stats.present}</p>
                                    <p className="text-xs text-muted-foreground">{t("presentDays")}</p>
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
                                    <p className="text-2xl font-display font-bold text-foreground tabular-nums">{stats.absent}</p>
                                    <p className="text-xs text-muted-foreground">{t("absentDays")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-card-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-display font-bold text-foreground tabular-nums">{stats.late}</p>
                                    <p className="text-xs text-muted-foreground">{t("lateArrivals")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-card-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Clock className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-display font-bold tabular-nums text-foreground">{stats.totalWorkingHours}</p>
                                    <p className="text-xs text-muted-foreground">{t("totalHours")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Attendance Table */}
            <Card className="bg-card border-card-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-400" />
                        {t("dailyAttendance")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {records.length === 0 ? (
                        <div className="p-8 text-center">
                            <Calendar className="h-12 w-12 text-muted-text mx-auto mb-4" />
                            <p className="text-muted-foreground">{t("noRecords")}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-card-border">
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("dateCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("dayCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("statusCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("checkInCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("checkOutCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("hoursCol")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((record) => (
                                        <tr
                                            key={record.id}
                                            className="border-b border-card-border hover:bg-hover"
                                        >
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {formatTableDate(record.date)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                                {record.dayOfWeek}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(record.status)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {record.checkIn || "-"}
                                                {record.lateMinutes && record.lateMinutes > 0 && (
                                                    <span className="ml-2 text-xs text-yellow-400">
                                                        {t("lateMinutes", { minutes: record.lateMinutes })}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {record.checkOut || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {record.workingHours || "-"}
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
