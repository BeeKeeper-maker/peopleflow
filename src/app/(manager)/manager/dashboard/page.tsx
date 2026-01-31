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

interface TeamMember {
    id: string;
    name: string;
    designation: string;
    status: "present" | "absent" | "on_leave" | "late";
    avatar?: string;
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
    const { data: session } = useSession();
    const [isLoading, setIsLoading] = useState(true);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
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
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    };

    // Fetch dashboard data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // TODO: Fetch real data from APIs
                await new Promise((resolve) => setTimeout(resolve, 1000));

                setTeamMembers([
                    { id: "1", name: "Rahul Ahmed", designation: "Senior Developer", status: "present" },
                    { id: "2", name: "Fatima Khan", designation: "UI Designer", status: "present" },
                    { id: "3", name: "Imran Hossain", designation: "Backend Developer", status: "late" },
                    { id: "4", name: "Sarah Islam", designation: "QA Engineer", status: "on_leave" },
                    { id: "5", name: "Mohammed Ali", designation: "DevOps Engineer", status: "present" },
                ]);

                setTeamStats({
                    total: 5,
                    present: 3,
                    absent: 0,
                    onLeave: 1,
                });

                setPendingApprovals([
                    {
                        id: "1",
                        type: "leave",
                        employeeName: "Rahul Ahmed",
                        description: "Casual Leave - 2 days",
                        date: "Feb 5-6, 2026",
                    },
                    {
                        id: "2",
                        type: "leave",
                        employeeName: "Sarah Islam",
                        description: "Sick Leave - 1 day",
                        date: "Feb 3, 2026",
                    },
                    {
                        id: "3",
                        type: "expense",
                        employeeName: "Mohammed Ali",
                        description: "Travel Expense - ৳5,000",
                        date: "Jan 28, 2026",
                    },
                ]);

                setUpcomingEvents([
                    { id: "1", type: "birthday", employeeName: "Fatima Khan", date: "Feb 5" },
                    { id: "2", type: "anniversary", employeeName: "Imran Hossain", date: "Feb 10" },
                ]);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
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
                return null;
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
                return "";
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
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
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {getGreeting()}, {firstName}! 👋
                    </h1>
                    <p className="text-white/60 mt-1">
                        Here's an overview of your team today.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/manager/approvals">
                        <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400">
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Pending Approvals ({pendingApprovals.length})
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Team Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Users className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{teamStats.total}</p>
                                <p className="text-sm text-white/60">Team Size</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-6 w-6 text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{teamStats.present}</p>
                                <p className="text-sm text-white/60">Present</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                                <XCircle className="h-6 w-6 text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{teamStats.absent}</p>
                                <p className="text-sm text-white/60">Absent</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Calendar className="h-6 w-6 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{teamStats.onLeave}</p>
                                <p className="text-sm text-white/60">On Leave</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pending Approvals */}
                <Card className="bg-[#141419] border-white/5 lg:col-span-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-white text-lg flex items-center gap-2">
                                <CheckSquare className="h-5 w-5 text-orange-400" />
                                Pending Approvals
                            </CardTitle>
                            <Link href="/manager/approvals">
                                <Button variant="ghost" size="sm" className="text-orange-400 hover:text-orange-300">
                                    View All
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {pendingApprovals.map((approval) => (
                                <div
                                    key={approval.id}
                                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center ${approval.type === "leave"
                                                    ? "bg-blue-500/20"
                                                    : "bg-green-500/20"
                                                }`}
                                        >
                                            {approval.type === "leave" ? (
                                                <Calendar className="h-5 w-5 text-blue-400" />
                                            ) : (
                                                <Clock className="h-5 w-5 text-green-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">
                                                {approval.employeeName}
                                            </p>
                                            <p className="text-xs text-white/40">{approval.description}</p>
                                            <p className="text-xs text-white/30">{approval.date}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-500"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Upcoming Events */}
                <Card className="bg-[#141419] border-white/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                            <Gift className="h-5 w-5 text-pink-400" />
                            Upcoming Events
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {upcomingEvents.map((event) => (
                                <div
                                    key={event.id}
                                    className="flex items-center gap-4 p-3 rounded-lg bg-white/5"
                                >
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center ${event.type === "birthday"
                                                ? "bg-pink-500/20"
                                                : "bg-purple-500/20"
                                            }`}
                                    >
                                        {event.type === "birthday" ? (
                                            <Cake className="h-5 w-5 text-pink-400" />
                                        ) : (
                                            <Gift className="h-5 w-5 text-purple-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">
                                            {event.employeeName}
                                        </p>
                                        <p className="text-xs text-white/40">
                                            {event.type === "birthday" ? "Birthday" : "Work Anniversary"} • {event.date}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Team Status */}
            <Card className="bg-[#141419] border-white/5">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-400" />
                            Today's Team Status
                        </CardTitle>
                        <Link href="/manager/team">
                            <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                                View Team
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teamMembers.map((member) => (
                            <div
                                key={member.id}
                                className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5"
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={member.avatar} />
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                        {member.name[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                        {member.name}
                                    </p>
                                    <p className="text-xs text-white/40 truncate">
                                        {member.designation}
                                    </p>
                                </div>
                                <Badge className={getStatusColor(member.status)}>
                                    {getStatusIcon(member.status)}
                                    <span className="ml-1 capitalize">
                                        {member.status.replace("_", " ")}
                                    </span>
                                </Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
