"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Users, Mail, Phone, ChevronRight,
    Calendar, Target, CheckCircle2, XCircle, Clock, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/ui/toast";
interface TeamMember {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    designation?: { name: string };
    department?: { name: string };
    photoUrl?: string;
    joiningDate?: string;
    status?: string;
}

export default function ManagerTeamPage() {
    const { addToast } = useToast();
    const t = useTranslations("ManagerTeam");
    const [isLoading, setIsLoading] = useState(true);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [attendanceToday, setAttendanceToday] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const employeesRes = await fetch("/api/manager/team");
                if (employeesRes.ok) {
                    const data = await employeesRes.json();
                    setTeamMembers(data.data || data || []);
                }
                const today = new Date().toISOString().split("T")[0];
                const attendanceRes = await fetch(`/api/attendance?date=${today}`);
                if (attendanceRes.ok) {
                    const data = await attendanceRes.json();
                    const records = data.data || data || [];
                    const statusMap: Record<string, string> = {};
                    records.forEach((r: { employeeId: string; status: string }) => {
                        statusMap[r.employeeId] = r.status || "present";
                    });
                    setAttendanceToday(statusMap);
                }
            } catch (error) { console.error("Error fetching team:", error); }
            finally { setIsLoading(false); }
        };
        fetchData();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "present": return (<Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />{t("present")}</Badge>);
            case "absent": return (<Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />{t("absent")}</Badge>);
            case "late": return (<Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />{t("late")}</Badge>);
            case "on_leave": return (<Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Calendar className="h-3 w-3 mr-1" />{t("onLeave")}</Badge>);
            default: return (<Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30"><Clock className="h-3 w-3 mr-1" />{t("notCheckedIn")}</Badge>);
        }
    };

    const filteredMembers = teamMembers.filter(
        (member) =>
            `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.designation?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const presentCount = Object.values(attendanceToday).filter(s => s === "present").length;
    const onLeaveCount = Object.values(attendanceToday).filter(s => s === "on_leave").length;
    const lateCount = Object.values(attendanceToday).filter(s => s === "late").length;

    if (isLoading) {
        return (<div className="space-y-6"><Skeleton className="h-12 w-64" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">{t("teamMembersCount", { count: teamMembers.length })}</p>
                </div>
                <Input
                    placeholder={t("searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-xs bg-hover border-card-border text-foreground"
                />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card border-card-border"><CardContent className="p-4"><p className="text-2xl font-display font-bold text-foreground tabular-nums">{teamMembers.length}</p><p className="text-sm text-muted-foreground">{t("totalMembers")}</p></CardContent></Card>
                <Card className="bg-card border-card-border"><CardContent className="p-4"><p className="text-2xl font-display font-bold text-green-400">{presentCount}</p><p className="text-sm text-muted-foreground">{t("presentToday")}</p></CardContent></Card>
                <Card className="bg-card border-card-border"><CardContent className="p-4"><p className="text-2xl font-display font-bold text-blue-400">{onLeaveCount}</p><p className="text-sm text-muted-foreground">{t("onLeave")}</p></CardContent></Card>
                <Card className="bg-card border-card-border"><CardContent className="p-4"><p className="text-2xl font-display font-bold text-yellow-400">{lateCount}</p><p className="text-sm text-muted-foreground">{t("lateToday")}</p></CardContent></Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMembers.map((member) => (
                    <Card key={member.id} className="bg-card border-card-border hover:border-card-border transition-colors">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12"><AvatarImage src={member.photoUrl} /><AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-white">{member.firstName[0]}</AvatarFallback></Avatar>
                                    <div>
                                        <h3 className="font-medium text-foreground">{member.firstName} {member.lastName}</h3>
                                        <p className="text-sm text-muted-foreground">{member.designation?.name || t("noDesignation")}</p>
                                    </div>
                                </div>
                                {getStatusBadge(attendanceToday[member.id] || "none")}
                            </div>
                            <div className="space-y-2 mb-4">
                                {member.email && (<div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /><span className="truncate">{member.email}</span></div>)}
                                {member.phone && (<div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /><span>{member.phone}</span></div>)}
                            </div>
                            <div className="p-3 rounded-lg bg-hover mb-4">
                                <p className="text-sm text-muted-foreground">{member.department?.name || t("noDepartment")}</p>
                                {member.joiningDate && (<p className="text-xs text-tertiary-foreground mt-1">{t("joined")}: {new Date(member.joiningDate).toLocaleDateString()}</p>)}
                            </div>
                            <div className="flex gap-2">
                                <Link href={`/employees/${member.id}`} className="flex-1">
                                    <Button size="sm" variant="outline" className="w-full border-card-border text-muted-foreground hover:text-foreground">{t("viewProfile")}</Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredMembers.length === 0 && (
                <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-text mx-auto mb-4" />
                    <p className="text-muted-foreground">{t("noTeamMembers")}</p>
                </div>
            )}
        </div>
    );
}
