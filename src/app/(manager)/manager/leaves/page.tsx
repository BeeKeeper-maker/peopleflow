"use client";

import { useEffect, useState } from "react";
import {
    Calendar, ChevronLeft, ChevronRight, CheckCircle2,
    Clock, XCircle, AlertTriangle, Palmtree,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

interface TeamLeave {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeDesignation: string;
    employeeAvatar?: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    days: number;
    status: "approved" | "pending" | "rejected";
    reason: string;
}

export default function ManagerLeavesPage() {
    const t = useTranslations("ManagerLeaves");
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [teamLeaves, setTeamLeaves] = useState<TeamLeave[]>([]);
    const monthName = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth() + 1;
                const res = await fetch(`/api/leaves/applications?year=${year}&month=${month}`);
                if (res.ok) {
                    const data = await res.json();
                    const applications = data.data || data || [];
                    const transformed: TeamLeave[] = applications.map((app: any) => ({
                        id: app.id, employeeId: app.employeeId,
                        employeeName: app.employee?.firstName && app.employee?.lastName
                            ? `${app.employee.firstName} ${app.employee.lastName}` : "Unknown Employee",
                        employeeDesignation: app.employee?.designation?.name || "N/A",
                        employeeAvatar: app.employee?.avatar,
                        leaveType: app.leaveType?.name || "Leave",
                        fromDate: app.startDate, toDate: app.endDate,
                        days: app.totalDays || 1,
                        status: app.status?.toLowerCase() || "pending",
                        reason: app.reason || "",
                    }));
                    setTeamLeaves(transformed);
                }
            } catch (error) { console.error("Error fetching team leaves:", error); }
            finally { setIsLoading(false); }
        };
        fetchData();
    }, [currentMonth]);

    const goToPreviousMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const goToNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved": return (<Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />{t("approved")}</Badge>);
            case "pending": return (<Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />{t("pending")}</Badge>);
            case "rejected": return (<Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />{t("rejected")}</Badge>);
            default: return null;
        }
    };

    const getLeaveTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            "Casual Leave": "bg-blue-500/20 text-blue-400 border-blue-500/30",
            "Sick Leave": "bg-red-500/20 text-red-400 border-red-500/30",
            "Annual Leave": "bg-purple-500/20 text-purple-400 border-purple-500/30",
            "Maternity Leave": "bg-pink-500/20 text-pink-400 border-pink-500/30",
        };
        return (<Badge className={colors[type] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}>{type}</Badge>);
    };

    const stats = {
        pending: teamLeaves.filter((l) => l.status === "pending").length,
        approved: teamLeaves.filter((l) => l.status === "approved").length,
        rejected: teamLeaves.filter((l) => l.status === "rejected").length,
        totalDays: teamLeaves.filter((l) => l.status === "approved").reduce((acc, l) => acc + l.days, 0),
    };

    if (isLoading) {
        return (<div className="space-y-6"><Skeleton className="h-12 w-64" /><div className="grid grid-cols-1 md:grid-cols-4 gap-6"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></div>);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="border-card-border text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="px-4 py-2 bg-card rounded-lg text-foreground font-medium min-w-[160px] text-center">{monthName}</span>
                    <Button variant="outline" size="icon" onClick={goToNextMonth} className="border-card-border text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card border-card-border"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center"><Clock className="h-5 w-5 text-yellow-400" /></div><div><p className="text-2xl font-bold text-foreground">{stats.pending}</p><p className="text-xs text-muted-foreground">{t("pending")}</p></div></div></CardContent></Card>
                <Card className="bg-card border-card-border"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-green-400" /></div><div><p className="text-2xl font-bold text-foreground">{stats.approved}</p><p className="text-xs text-muted-foreground">{t("approved")}</p></div></div></CardContent></Card>
                <Card className="bg-card border-card-border"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><XCircle className="h-5 w-5 text-red-400" /></div><div><p className="text-2xl font-bold text-foreground">{stats.rejected}</p><p className="text-xs text-muted-foreground">{t("rejected")}</p></div></div></CardContent></Card>
                <Card className="bg-card border-card-border"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center"><Palmtree className="h-5 w-5 text-purple-400" /></div><div><p className="text-2xl font-bold text-foreground">{stats.totalDays}</p><p className="text-xs text-muted-foreground">{t("totalDaysOff")}</p></div></div></CardContent></Card>
            </div>

            <Card className="bg-card border-card-border">
                <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Calendar className="h-5 w-5 text-orange-400" />{t("leaveApplications")}</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {teamLeaves.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground"><Calendar className="h-12 w-12 mx-auto mb-3 text-muted-text" /><p>{t("noLeaveApplications")}</p></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-card-border">
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("employeeCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("typeCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("durationCol")}</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">{t("daysCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("reasonCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("statusCol")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamLeaves.map((leave) => (
                                        <tr key={leave.id} className="border-b border-card-border hover:bg-hover">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8"><AvatarImage src={leave.employeeAvatar} /><AvatarFallback className="bg-linear-to-br from-orange-500 to-red-600 text-foreground text-xs">{leave.employeeName[0]}</AvatarFallback></Avatar>
                                                    <div><p className="text-sm font-medium text-foreground">{leave.employeeName}</p><p className="text-xs text-tertiary-foreground">{leave.employeeDesignation}</p></div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">{getLeaveTypeBadge(leave.leaveType)}</td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {new Date(leave.fromDate).toLocaleDateString()}
                                                {leave.fromDate !== leave.toDate && (<> - {new Date(leave.toDate).toLocaleDateString()}</>)}
                                            </td>
                                            <td className="px-4 py-3 text-center"><span className="text-foreground font-medium">{leave.days}</span></td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{leave.reason}</td>
                                            <td className="px-4 py-3">{getStatusBadge(leave.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {stats.pending > 0 && (
                <Card className="bg-card border-yellow-500/30">
                    <CardContent className="p-4 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0"><AlertTriangle className="h-5 w-5 text-yellow-400" /></div>
                        <div>
                            <h4 className="text-foreground font-medium">{t("staffingAlert")}</h4>
                            <p className="text-muted-foreground text-sm mt-1">{t("staffingAlertDesc", { count: stats.pending })}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
