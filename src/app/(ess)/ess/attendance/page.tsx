"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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

interface AttendanceRecord {
    id: string;
    date: string;
    dayOfWeek: string;
    status: "present" | "absent" | "half_day" | "on_leave" | "late" | "weekend" | "holiday";
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
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [stats, setStats] = useState<MonthlyStats | null>(null);

    const monthName = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth() + 1;

                // Fetch attendance records for the month
                const res = await fetch(`/api/attendance?year=${year}&month=${month}`);
                if (res.ok) {
                    const data = await res.json();
                    const rawRecords = data.data || data || [];

                    // Transform API data to UI format
                    const daysInMonth = new Date(year, month, 0).getDate();
                    const today = new Date();
                    const transformedRecords: AttendanceRecord[] = [];

                    // Create a map of existing records by date
                    const recordMap = new Map<string, AttendanceRecord>();
                    rawRecords.forEach((r: {
                        id: string;
                        date: string;
                        status?: string;
                        checkInTime?: string;
                        checkOutTime?: string;
                        totalMinutes?: number;
                        lateMinutes?: number;
                        earlyLeaveMinutes?: number;
                        overtimeMinutes?: number;
                    }) => {
                        const dateStr = r.date.split("T")[0];
                        recordMap.set(dateStr, {
                            id: r.id,
                            date: dateStr,
                            dayOfWeek: new Date(r.date).toLocaleDateString("en-US", { weekday: "long" }),
                            status: (r.status as AttendanceRecord["status"]) || "present",
                            checkIn: r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : undefined,
                            checkOut: r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : undefined,
                            workingHours: r.totalMinutes ? `${Math.floor(r.totalMinutes / 60)}h ${r.totalMinutes % 60}m` : undefined,
                            lateMinutes: r.lateMinutes,
                            earlyLeaveMinutes: r.earlyLeaveMinutes,
                            overtime: r.overtimeMinutes ? `${Math.floor(r.overtimeMinutes / 60)}h ${r.overtimeMinutes % 60}m` : undefined,
                        });
                    });

                    // Fill in all days of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(year, month - 1, day);
                        const dateStr = date.toISOString().split("T")[0];
                        const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const isFuture = date > today;

                        if (recordMap.has(dateStr)) {
                            transformedRecords.push(recordMap.get(dateStr)!);
                        } else {
                            transformedRecords.push({
                                id: `placeholder-${dateStr}`,
                                date: dateStr,
                                dayOfWeek,
                                status: isWeekend ? "weekend" : (isFuture ? "absent" : "absent"),
                            });
                        }
                    }

                    setRecords(transformedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

                    // Calculate stats from records
                    const presentCount = rawRecords.filter((r: { status?: string }) => r.status === "present").length;
                    const absentCount = rawRecords.filter((r: { status?: string }) => r.status === "absent").length;
                    const lateCount = rawRecords.filter((r: { status?: string }) => r.status === "late").length;
                    const onLeaveCount = rawRecords.filter((r: { status?: string }) => r.status === "on_leave").length;
                    const halfDayCount = rawRecords.filter((r: { status?: string }) => r.status === "half_day").length;

                    const totalMinutes = rawRecords.reduce((acc: number, r: { totalMinutes?: number }) => acc + (r.totalMinutes || 0), 0);
                    const totalHours = Math.floor(totalMinutes / 60);
                    const remainingMins = totalMinutes % 60;

                    // Calculate average check-in from actual records
                    const checkInTimes = rawRecords
                        .filter((r: { checkInTime?: string }) => r.checkInTime)
                        .map((r: { checkInTime: string }) => new Date(r.checkInTime));
                    let avgCheckIn = "N/A";
                    if (checkInTimes.length > 0) {
                        const avgMs = checkInTimes.reduce((sum: number, d: Date) => {
                            const dayStart = new Date(d);
                            dayStart.setHours(0, 0, 0, 0);
                            return sum + (d.getTime() - dayStart.getTime());
                        }, 0) / checkInTimes.length;
                        const avgDate = new Date();
                        avgDate.setHours(0, 0, 0, 0);
                        avgDate.setMilliseconds(avgMs);
                        avgCheckIn = avgDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    }

                    setStats({
                        present: presentCount,
                        absent: absentCount,
                        halfDay: halfDayCount,
                        onLeave: onLeaveCount,
                        late: lateCount,
                        earlyLeave: 0,
                        totalWorkingHours: `${totalHours}h ${remainingMins}m`,
                        averageCheckIn: avgCheckIn,
                    });
                } else {
                    setRecords([]);
                    setStats(null);
                }
            } catch (error) {
                console.error("Error fetching attendance:", error);
                setRecords([]);
                setStats(null);
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
                                    <p className="text-2xl font-bold text-foreground">{stats.present}</p>
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
                                    <p className="text-2xl font-bold text-foreground">{stats.absent}</p>
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
                                    <p className="text-2xl font-bold text-foreground">{stats.late}</p>
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
                                    <p className="text-lg font-bold text-foreground">{stats.totalWorkingHours}</p>
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
                                                {new Date(record.date).toLocaleDateString()}
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
