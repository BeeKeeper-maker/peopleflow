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
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [teamAttendance, setTeamAttendance] = useState<TeamMemberAttendance[]>([]);

    const monthName = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                await new Promise((resolve) => setTimeout(resolve, 800));

                setTeamAttendance([
                    {
                        id: "1",
                        name: "Rahul Ahmed",
                        designation: "Senior Developer",
                        presentDays: 18,
                        absentDays: 1,
                        lateArrivals: 2,
                        avgCheckIn: "9:05 AM",
                        avgWorkHours: "8h 45m",
                        todayStatus: "present",
                    },
                    {
                        id: "2",
                        name: "Fatima Khan",
                        designation: "UI Designer",
                        presentDays: 17,
                        absentDays: 2,
                        lateArrivals: 1,
                        avgCheckIn: "9:10 AM",
                        avgWorkHours: "8h 30m",
                        todayStatus: "present",
                    },
                    {
                        id: "3",
                        name: "Imran Hossain",
                        designation: "Backend Developer",
                        presentDays: 19,
                        absentDays: 0,
                        lateArrivals: 4,
                        avgCheckIn: "9:25 AM",
                        avgWorkHours: "8h 15m",
                        todayStatus: "late",
                    },
                    {
                        id: "4",
                        name: "Sarah Islam",
                        designation: "QA Engineer",
                        presentDays: 15,
                        absentDays: 1,
                        lateArrivals: 0,
                        avgCheckIn: "8:55 AM",
                        avgWorkHours: "8h 50m",
                        todayStatus: "on_leave",
                    },
                    {
                        id: "5",
                        name: "Mohammed Ali",
                        designation: "DevOps Engineer",
                        presentDays: 18,
                        absentDays: 1,
                        lateArrivals: 1,
                        avgCheckIn: "9:00 AM",
                        avgWorkHours: "9h 0m",
                        todayStatus: "present",
                    },
                ]);
            } catch (error) {
                console.error("Error fetching team attendance:", error);
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
            case "late":
                return (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Late
                    </Badge>
                );
            case "on_leave":
                return (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        <Calendar className="h-3 w-3 mr-1" />
                        On Leave
                    </Badge>
                );
            case "not_checked_in":
                return (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Checked In
                    </Badge>
                );
            default:
                return null;
        }
    };

    // Calculate team stats
    const teamStats = {
        presentToday: teamAttendance.filter((m) => m.todayStatus === "present").length,
        avgAttendance: Math.round(
            (teamAttendance.reduce((acc, m) => acc + m.presentDays, 0) / (teamAttendance.length * 20)) * 100
        ),
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
                    <h1 className="text-2xl font-bold text-white">Team Attendance</h1>
                    <p className="text-white/60 mt-1">
                        Monitor your team's attendance patterns
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

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{teamStats.presentToday}</p>
                                <p className="text-xs text-white/60">Present Today</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{teamStats.avgAttendance}%</p>
                                <p className="text-xs text-white/60">Avg Attendance</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{teamStats.totalLateArrivals}</p>
                                <p className="text-xs text-white/60">Late Arrivals</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Users className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{teamAttendance.length}</p>
                                <p className="text-xs text-white/60">Team Members</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Team Attendance Table */}
            <Card className="bg-[#141419] border-white/5">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Users className="h-5 w-5 text-orange-400" />
                        Individual Attendance
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Employee</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Today</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-white/60">Present</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-white/60">Absent</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-white/60">Late</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Avg Check-In</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-white/60">Avg Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teamAttendance.map((member) => (
                                    <tr
                                        key={member.id}
                                        className="border-b border-white/5 hover:bg-white/5"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={member.avatar} />
                                                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-red-600 text-white text-xs">
                                                        {member.name[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{member.name}</p>
                                                    <p className="text-xs text-white/40">{member.designation}</p>
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
                                        <td className="px-4 py-3 text-sm text-white/60">{member.avgCheckIn}</td>
                                        <td className="px-4 py-3 text-sm text-white">{member.avgWorkHours}</td>
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
