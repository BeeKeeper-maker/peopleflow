"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Users,
    Mail,
    Phone,
    ChevronRight,
    Calendar,
    Target,
    CheckCircle2,
    XCircle,
    Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

interface TeamMember {
    id: string;
    name: string;
    email: string;
    phone: string;
    designation: string;
    department: string;
    status: "present" | "absent" | "on_leave" | "late";
    avatar?: string;
    joiningDate: string;
    pendingGoals: number;
    leaveBalance: number;
}

export default function ManagerTeamPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                await new Promise((resolve) => setTimeout(resolve, 1000));

                setTeamMembers([
                    {
                        id: "1",
                        name: "Rahul Ahmed",
                        email: "rahul@company.com",
                        phone: "+880 1711-111111",
                        designation: "Senior Developer",
                        department: "Engineering",
                        status: "present",
                        joiningDate: "2022-03-15",
                        pendingGoals: 2,
                        leaveBalance: 12,
                    },
                    {
                        id: "2",
                        name: "Fatima Khan",
                        email: "fatima@company.com",
                        phone: "+880 1711-222222",
                        designation: "UI Designer",
                        department: "Design",
                        status: "present",
                        joiningDate: "2023-01-10",
                        pendingGoals: 1,
                        leaveBalance: 15,
                    },
                    {
                        id: "3",
                        name: "Imran Hossain",
                        email: "imran@company.com",
                        phone: "+880 1711-333333",
                        designation: "Backend Developer",
                        department: "Engineering",
                        status: "late",
                        joiningDate: "2021-06-20",
                        pendingGoals: 3,
                        leaveBalance: 8,
                    },
                    {
                        id: "4",
                        name: "Sarah Islam",
                        email: "sarah@company.com",
                        phone: "+880 1711-444444",
                        designation: "QA Engineer",
                        department: "Quality",
                        status: "on_leave",
                        joiningDate: "2022-09-01",
                        pendingGoals: 0,
                        leaveBalance: 5,
                    },
                    {
                        id: "5",
                        name: "Mohammed Ali",
                        email: "mohammed@company.com",
                        phone: "+880 1711-555555",
                        designation: "DevOps Engineer",
                        department: "Infrastructure",
                        status: "present",
                        joiningDate: "2023-04-15",
                        pendingGoals: 2,
                        leaveBalance: 18,
                    },
                ]);
            } catch (error) {
                console.error("Error fetching team:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

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
            default:
                return null;
        }
    };

    const filteredMembers = teamMembers.filter(
        (member) =>
            member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.designation.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">My Team</h1>
                    <p className="text-white/60 mt-1">
                        {teamMembers.length} direct reports
                    </p>
                </div>
                <Input
                    placeholder="Search team members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-xs bg-white/5 border-white/10 text-white"
                />
            </div>

            {/* Team Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-white">{teamMembers.length}</p>
                        <p className="text-sm text-white/60">Total Members</p>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-green-400">
                            {teamMembers.filter((m) => m.status === "present").length}
                        </p>
                        <p className="text-sm text-white/60">Present Today</p>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-blue-400">
                            {teamMembers.filter((m) => m.status === "on_leave").length}
                        </p>
                        <p className="text-sm text-white/60">On Leave</p>
                    </CardContent>
                </Card>
                <Card className="bg-[#141419] border-white/5">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-purple-400">
                            {teamMembers.reduce((acc, m) => acc + m.pendingGoals, 0)}
                        </p>
                        <p className="text-sm text-white/60">Pending Goals</p>
                    </CardContent>
                </Card>
            </div>

            {/* Team Members Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMembers.map((member) => (
                    <Card key={member.id} className="bg-[#141419] border-white/5 hover:border-white/10 transition-colors">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={member.avatar} />
                                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                            {member.name[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-medium text-white">{member.name}</h3>
                                        <p className="text-sm text-white/60">{member.designation}</p>
                                    </div>
                                </div>
                                {getStatusBadge(member.status)}
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm text-white/60">
                                    <Mail className="h-4 w-4" />
                                    <span>{member.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-white/60">
                                    <Phone className="h-4 w-4" />
                                    <span>{member.phone}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-white/5">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-white">{member.leaveBalance}</p>
                                    <p className="text-xs text-white/40">Leave Balance</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-white">{member.pendingGoals}</p>
                                    <p className="text-xs text-white/40">Pending Goals</p>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 border-white/10 text-white/60 hover:text-white"
                                >
                                    <Target className="h-4 w-4 mr-1" />
                                    Goals
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 border-white/10 text-white/60 hover:text-white"
                                >
                                    <Calendar className="h-4 w-4 mr-1" />
                                    Leaves
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredMembers.length === 0 && (
                <div className="text-center py-12">
                    <Users className="h-12 w-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60">No team members found</p>
                </div>
            )}
        </div>
    );
}
