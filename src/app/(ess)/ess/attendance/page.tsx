"use client";

import { useEffect, useState } from "react";
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
    date: string;
    dayOfWeek: string;
    status: "present" | "absent" | "half_day" | "on_leave" | "weekend" | "holiday";
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
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [stats, setStats] = useState<MonthlyStats | null>(null);

    const monthName = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Generate mock data for the month
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const today = new Date();

                const mockRecords: AttendanceRecord[] = [];

                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day);
                    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isFuture = date > today;

                    let record: AttendanceRecord = {
                        date: date.toISOString().split("T")[0],
                        dayOfWeek,
                        status: "present",
                    };

                    if (isWeekend) {
                        record.status = "weekend";
                    } else if (isFuture) {
                        record.status = "absent"; // Will show as blank/future
                    } else {
                        // Random status for demo
                        const rand = Math.random();
                        if (rand > 0.95) {
                            record.status = "on_leave";
                        } else if (rand > 0.90) {
                            record.status = "absent";
                        } else if (rand > 0.85) {
                            record.status = "half_day";
                            record.checkIn = "9:00 AM";
                            record.checkOut = "1:00 PM";
                            record.workingHours = "4h 0m";
                        } else {
                            record.status = "present";
                            const checkInHour = 8 + Math.floor(Math.random() * 2);
                            const checkInMin = Math.floor(Math.random() * 60);
                            record.checkIn = `${checkInHour}:${checkInMin.toString().padStart(2, "0")} AM`;
                            record.checkOut = "6:00 PM";
                            record.workingHours = `${10 - checkInHour}h ${60 - checkInMin}m`;
                            if (checkInHour >= 9 && checkInMin > 0) {
                                record.lateMinutes = (checkInHour - 9) * 60 + checkInMin;
                            }
                        }
                    }

                    mockRecords.push(record);
                }

                setRecords(mockRecords);

                setStats({
                    present: 18,
                    absent: 1,
                    halfDay: 1,
                    onLeave: 2,
                    late: 3,
                    earlyLeave: 1,
                    totalWorkingHours: "162h 30m",
                    averageCheckIn: "9:05 AM",
                });
            } catch (error) {
                console.error("Error fetching attendance:", error);
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
                        Present
                    </Badge>
                );
            case "absent":
                return (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        Absent
                    </Badge>
                );
            case "half_day":
                return (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Half Day
                    </Badge>
                );
            case "on_leave":
                return (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        <Calendar className="h-3 w-3 mr-1" />
                        On Leave
                    </Badge>
                );
            case "weekend":
                return (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                        Weekend
                    </Badge>
                );
            case "holiday":
                return (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        Holiday
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
                    <h1 className="text-2xl font-bold text-white">My Attendance</h1>
                    <p className="text-white/60 mt-1">
                        Track your attendance history
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToPreviousMonth}
                        className="border-white/10 text-white/60 hover:text-white"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-4 py-2 bg-[#141419] rounded-lg text-white font-medium min-w-[160px] text-center">
                        {monthName}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToNextMonth}
                        className="border-white/10 text-white/60 hover:text-white"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-[#141419] border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{stats.present}</p>
                                    <p className="text-xs text-white/60">Present Days</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#141419] border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                    <XCircle className="h-5 w-5 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{stats.absent}</p>
                                    <p className="text-xs text-white/60">Absent Days</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#141419] border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{stats.late}</p>
                                    <p className="text-xs text-white/60">Late Arrivals</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#141419] border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Clock className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-white">{stats.totalWorkingHours}</p>
                                    <p className="text-xs text-white/60">Total Hours</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Attendance Table */}
            <Card className="bg-[#141419] border-white/5">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-400" />
                        Daily Attendance
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Day</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Check In</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Check Out</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.slice(0, 15).map((record) => (
                                    <tr
                                        key={record.date}
                                        className="border-b border-white/5 hover:bg-white/5"
                                    >
                                        <td className="px-4 py-3 text-sm text-white">
                                            {new Date(record.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white/60">
                                            {record.dayOfWeek}
                                        </td>
                                        <td className="px-4 py-3">
                                            {getStatusBadge(record.status)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white">
                                            {record.checkIn || "-"}
                                            {record.lateMinutes && record.lateMinutes > 0 && (
                                                <span className="ml-2 text-xs text-yellow-400">
                                                    (+{record.lateMinutes}m late)
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white">
                                            {record.checkOut || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white">
                                            {record.workingHours || "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
