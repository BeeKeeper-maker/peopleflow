"use client";

import { useCallback, useMemo, useState } from "react";
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Filter,
    Palmtree,
    RefreshCw,
    Search,
    Users,
    XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

import { useManagerLeaves, type ManagerLeaveApproval } from "@/hooks/use-data";

type LeaveStatus = "approved" | "pending" | "rejected" | "cancelled";
type LeaveFilter = "all" | "active" | LeaveStatus;

interface TeamLeave {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeDesignation: string;
    employeeAvatar?: string | null;
    leaveType: string;
    fromDate: string;
    toDate: string;
    days: number;
    status: LeaveStatus;
    reason: string;
    appliedAt: string;
}

function normalizeStatus(status: string | null | undefined): LeaveStatus {
    const normalized = (status || "pending").toLowerCase();
    if (["approved", "pending", "rejected", "cancelled"].includes(normalized)) return normalized as LeaveStatus;
    return "pending";
}

function csvEscape(value: unknown) {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function ManagerLeavesPage() {
    const t = useTranslations("ManagerLeaves");
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<LeaveFilter>("all");

    const monthName = new Intl.DateTimeFormat(dateLocale, { month: "long", year: "numeric" }).format(currentMonth);

    const formatDate = useCallback((value: string) => (
        new Intl.DateTimeFormat(dateLocale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    ), [dateLocale]);

    // ── TanStack Query: team leaves for the selected month ──
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const { data: applications = [], isLoading, isFetching, refetch } = useManagerLeaves({ year, month, limit: 100 });

    const teamLeaves: TeamLeave[] = useMemo(() => {
        return (applications as ManagerLeaveApproval[]).map((app) => {
            const firstName = app.employee?.firstName || "";
            const lastName = app.employee?.lastName || "";
            const employeeName = `${firstName} ${lastName}`.trim() || t("unknownEmployee");

            return {
                id: app.id,
                employeeId: app.employeeId || app.employee?.id || "",
                employeeName,
                employeeDesignation: app.employee?.designation?.name || t("noDesignation"),
                employeeAvatar: app.employee?.photoUrl || null,
                leaveType: app.leaveType?.name || t("genericLeave"),
                fromDate: app.fromDate,
                toDate: app.toDate,
                days: Number(app.totalDays || 1),
                status: normalizeStatus(app.status),
                reason: app.reason || "",
                appliedAt: app.appliedAt || app.createdAt || app.fromDate,
            };
        });
    }, [applications, t]);

    const goToPreviousMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const goToNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const stats = useMemo(() => ({
        pending: teamLeaves.filter((leave) => leave.status === "pending").length,
        approved: teamLeaves.filter((leave) => leave.status === "approved").length,
        rejected: teamLeaves.filter((leave) => leave.status === "rejected").length,
        totalDays: teamLeaves.filter((leave) => leave.status === "approved").reduce((acc, leave) => acc + leave.days, 0),
        activeEmployees: new Set(teamLeaves.filter((leave) => leave.status === "approved" || leave.status === "pending").map((leave) => leave.employeeId)).size,
    }), [teamLeaves]);

    const filteredLeaves = useMemo(() => {
        const q = search.trim().toLowerCase();
        return teamLeaves.filter((leave) => {
            if (statusFilter === "active" && !["pending", "approved"].includes(leave.status)) return false;
            if (statusFilter !== "all" && statusFilter !== "active" && leave.status !== statusFilter) return false;
            if (!q) return true;
            return `${leave.employeeName} ${leave.employeeDesignation} ${leave.leaveType} ${leave.reason}`.toLowerCase().includes(q);
        });
    }, [search, statusFilter, teamLeaves]);

    const getStatusBadge = (status: LeaveStatus) => {
        const config = {
            approved: { label: t("approved"), icon: CheckCircle2, className: "bg-green-500/20 text-green-400 border-green-500/30" },
            pending: { label: t("pending"), icon: Clock, className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
            rejected: { label: t("rejected"), icon: XCircle, className: "bg-red-500/20 text-red-400 border-red-500/30" },
            cancelled: { label: t("cancelled"), icon: XCircle, className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
        }[status];
        const Icon = config.icon;
        return <Badge className={cn("gap-1", config.className)}><Icon className="h-3 w-3" />{config.label}</Badge>;
    };

    const getLeaveTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            "Casual Leave": "bg-blue-500/20 text-blue-400 border-blue-500/30",
            "Sick Leave": "bg-red-500/20 text-red-400 border-red-500/30",
            "Annual Leave": "bg-purple-500/20 text-purple-400 border-purple-500/30",
            "Earned Leave": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            "Maternity Leave": "bg-pink-500/20 text-pink-400 border-pink-500/30",
            "Paternity Leave": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
            "Festival Leave": "bg-orange-500/20 text-orange-400 border-orange-500/30",
        };
        return <Badge className={colors[type] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}>{type}</Badge>;
    };

    const exportCsv = () => {
        const header = ["Employee", "Designation", "Leave Type", "From", "To", "Days", "Status", "Applied", "Reason"];
        const rows = filteredLeaves.map((leave) => [
            leave.employeeName,
            leave.employeeDesignation,
            leave.leaveType,
            formatDate(leave.fromDate),
            formatDate(leave.toDate),
            leave.days,
            leave.status,
            formatDate(leave.appliedAt),
            leave.reason,
        ].map(csvEscape).join(","));

        const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `team-leaves-${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}.csv`;
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
            <PageHeader
                title={t("title")}
                subtitle={t("subtitle")}
                icon={Calendar}
                iconColor="emerald"
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="border-card-border text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="px-4 py-2 bg-card rounded-lg text-foreground font-medium min-w-[170px] text-center">{monthName}</span>
                        <Button variant="outline" size="icon" onClick={goToNextMonth} className="border-card-border text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></Button>
                        <Button variant="outline" onClick={() => refetch()} className="gap-2"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />{t("refresh")}</Button>
                    </div>
                }
            />

            <Card className="bg-linear-to-r from-blue-500/10 via-card to-card border-blue-500/20">
                <CardContent className="p-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 font-semibold text-foreground"><Calendar className="h-5 w-5 text-blue-400" />{t("managerPurposeTitle")}</div>
                        <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">{t("managerPurposeDesc")}</p>
                    </div>
                    <Button onClick={() => setStatusFilter("active")} className="gap-2 self-start lg:self-auto"><Filter className="h-4 w-4" />{t("showActiveOnly")}</Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: t("pending"), value: stats.pending, icon: Clock, tone: "bg-yellow-500/20 text-yellow-400" },
                    { label: t("approved"), value: stats.approved, icon: CheckCircle2, tone: "bg-green-500/20 text-green-400" },
                    { label: t("rejected"), value: stats.rejected, icon: XCircle, tone: "bg-red-500/20 text-red-400" },
                    { label: t("totalDaysOff"), value: stats.totalDays, icon: Palmtree, tone: "bg-purple-500/20 text-purple-400" },
                    { label: t("affectedEmployees"), value: stats.activeEmployees, icon: Users, tone: "bg-blue-500/20 text-blue-400" },
                ].map((item) => {
                    const Icon = item.icon;
                    return (
                        <Card key={item.label} className="bg-card border-card-border">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", item.tone)}><Icon className="h-5 w-5" /></div>
                                    <div><p className="text-2xl font-display font-bold text-foreground tabular-nums">{item.value}</p><p className="text-xs text-muted-foreground">{item.label}</p></div>
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
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchLeaves")} className="pl-9" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {(["all", "active", "pending", "approved", "rejected"] as LeaveFilter[]).map((value) => (
                            <Button key={value} variant={statusFilter === value ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(value)}>
                                {value === "all" ? t("filterAll") : value === "active" ? t("active") : getStatusBadge(value)}
                            </Button>
                        ))}
                        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2"><Download className="h-4 w-4" />{t("exportCsv")}</Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card border-card-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2"><Calendar className="h-5 w-5 text-orange-400" />{t("leaveApplications")}</CardTitle>
                    <CardDescription>{t("leaveApplicationsDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredLeaves.length === 0 ? (
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
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("appliedCol")}</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("statusCol")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeaves.map((leave) => (
                                        <tr key={leave.id} className="border-b border-card-border hover:bg-hover">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={leave.employeeAvatar || undefined} />
                                                        <AvatarFallback className="bg-linear-to-br from-orange-500 to-red-600 text-white text-xs">{leave.employeeName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div><p className="text-sm font-medium text-foreground">{leave.employeeName}</p><p className="text-xs text-tertiary-foreground">{leave.employeeDesignation}</p></div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">{getLeaveTypeBadge(leave.leaveType)}</td>
                                            <td className="px-4 py-3 text-sm text-foreground">{formatDate(leave.fromDate)}{leave.fromDate !== leave.toDate && <> — {formatDate(leave.toDate)}</>}</td>
                                            <td className="px-4 py-3 text-center"><span className="text-foreground font-medium">{leave.days}</span></td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground max-w-[260px] truncate" title={leave.reason}>{leave.reason || "—"}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(leave.appliedAt)}</td>
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
