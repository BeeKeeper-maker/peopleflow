"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AttendanceDashboardCard } from "@/components/attendance/attendance-dashboard-card";
import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale, useTranslations } from "next-intl";
import { useRegularizationRequests, type RegularizationRequestRecord } from "@/hooks/use-data";
import {
    Clock,
    CheckCircle2,
    XCircle,
    Calendar,
    ClipboardEdit,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    Filter,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

type RegularizationRequest = RegularizationRequestRecord;

const statusConfig = {
    pending: { labelKey: "pendingLabel", color: "bg-amber-500/20 text-amber-400", icon: Clock },
    approved: { labelKey: "approvedLabel", color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle2 },
    rejected: { labelKey: "rejectedLabel", color: "bg-red-500/20 text-red-400", icon: XCircle },
};

// ════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════

export default function AttendancePage() {
    const t = useTranslations('Attendance');
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const formatRegularizationDate = (value: string) => new Intl.DateTimeFormat(dateLocale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [processing, setProcessing] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [regularizationStatusFilter, setRegularizationStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
    const [regularizationSearch, setRegularizationSearch] = useState("");

    // ── TanStack Query: regularization requests (lazy — only when tab is active) ──
    const { data: requests = [], isLoading: loadingReqs, isFetching: fetchingReqs, refetch } = useRegularizationRequests(
        regularizationStatusFilter,
        activeTab === "regularization",
    );

    const invalidateRegularization = () => {
        queryClient.invalidateQueries({ queryKey: ["attendance", "regularization"] });
    };

    // New request form
    const [formDate, setFormDate] = useState("");
    const [formCheckIn, setFormCheckIn] = useState("");
    const [formCheckOut, setFormCheckOut] = useState("");
    const [formReason, setFormReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleAction = async (id: string, action: "approve" | "reject") => {
        setProcessing(id);
        try {
            const res = await fetch(`/api/attendance/regularization/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (res.ok) {
                addToast({ title: action === "approve" ? t("requestApproved") : t("requestRejected"), description: action === "approve" ? t("approvedDesc") : t("rejectedDesc"), type: "success" });
                invalidateRegularization();
            } else {
                const err = await res.json();
                addToast({ title: t("networkError"), description: err.error || t("networkError"), type: "error" });
            }
        } catch {
            addToast({ title: t("networkError"), description: t("networkError"), type: "error" });
        } finally {
            setProcessing(null);
        }
    };

    const filteredRequests = useMemo(() => {
        const q = regularizationSearch.trim().toLowerCase();
        if (!q) return requests;
        return requests.filter((req) => {
            const employeeText = `${req.employee.firstName} ${req.employee.lastName} ${req.employee.employeeCode} ${req.employee.department?.name || ""}`.toLowerCase();
            return employeeText.includes(q) || req.reason.toLowerCase().includes(q) || req.status.includes(q);
        });
    }, [regularizationSearch, requests]);

    const statusLabel = (status: RegularizationRequest["status"]) => {
        if (status === "pending") return t("pendingLabel");
        if (status === "approved") return t("approvedLabel");
        return t("rejectedLabel");
    };

    const handleSubmitRequest = async () => {
        if (!formDate || !formReason) {
            addToast({ title: t("missingFields"), description: t("missingFieldsDesc"), type: "error" });
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/attendance/regularization", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: formDate,
                    requestedCheckIn: formCheckIn || undefined,
                    requestedCheckOut: formCheckOut || undefined,
                    reason: formReason,
                }),
            });
            if (res.ok) {
                addToast({ title: t("requestSubmitted"), description: t("requestSubmittedDesc"), type: "success" });
                setShowForm(false);
                setFormDate("");
                setFormCheckIn("");
                setFormCheckOut("");
                setFormReason("");
                invalidateRegularization();
            } else {
                const err = await res.json();
                addToast({ title: t("networkError"), description: err.error || t("networkError"), type: "error" });
            }
        } catch {
            addToast({ title: t("networkError"), description: t("networkError"), type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const pendingCount = requests.filter(r => r.status === "pending").length;

    return (
        <div className="flex-1 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 ring-1 ring-blue-500/20">
                        <Clock className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground">{t('title')}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-hover border-card-border">
                    <TabsTrigger value="dashboard">{t("dashboardTab")}</TabsTrigger>
                    <TabsTrigger value="regularization" className="gap-2">
                        <ClipboardEdit className="h-4 w-4" />
                        {t("regularizationTab")}
                        {pendingCount > 0 && (
                            <Badge className="bg-amber-500/20 text-amber-400 text-[10px] ml-1">
                                {pendingCount}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Original Dashboard Tab */}
                <TabsContent value="dashboard" className="mt-4">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                        <div className="col-span-4 lg:col-span-3 space-y-6">
                            <AttendanceDashboardCard />
                        </div>
                        <div className="col-span-4">
                            <AttendanceHistory />
                        </div>
                    </div>
                </TabsContent>

                {/* Regularization Tab */}
                <TabsContent value="regularization" className="mt-4 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">{t("regularizationTitle")}</h3>
                            <p className="text-sm text-muted-foreground">{t("regularizationSubtitle")}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="gap-2" onClick={() => refetch()} disabled={fetchingReqs}>
                                <RefreshCw className={`h-4 w-4 ${fetchingReqs ? "animate-spin" : ""}`} />
                                {t("refresh")}
                            </Button>
                            <Button className="gap-2" onClick={() => setShowForm(!showForm)}>
                            <Plus className="h-4 w-4" />
                                {t("newRequest")}
                            </Button>
                        </div>
                    </div>

                    {/* New Request Form */}
                    {showForm && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">{t("submitRegularization")}</CardTitle>
                                <CardDescription>{t("regularizeDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{t("dateField")}</Label>
                                        <Input
                                            type="date"
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("requestedCheckInTime")}</Label>
                                        <Input
                                            type="time"
                                            value={formCheckIn}
                                            onChange={(e) => setFormCheckIn(e.target.value)}
                                            placeholder="09:00"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("requestedCheckOutTime")}</Label>
                                        <Input
                                            type="time"
                                            value={formCheckOut}
                                            onChange={(e) => setFormCheckOut(e.target.value)}
                                            placeholder="18:00"
                                        />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>{t("reasonField")}</Label>
                                        <textarea
                                            value={formReason}
                                            onChange={(e) => setFormReason(e.target.value)}
                                            className="w-full h-20 px-3 py-2 rounded-lg bg-hover border border-card-border text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder={t("reasonPlaceholder")}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <Button variant="outline" onClick={() => setShowForm(false)}>{t("cancelAction")}</Button>
                                    <Button onClick={handleSubmitRequest} disabled={submitting} className="gap-2">
                                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardEdit className="h-4 w-4" />}
                                        {t("submitRequestBtn")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: t("pendingLabel"), value: requests.filter(r => r.status === "pending").length, bgColor: "bg-amber-500/20", textColor: "text-amber-400", icon: Clock },
                            { label: t("approvedLabel"), value: requests.filter(r => r.status === "approved").length, bgColor: "bg-emerald-500/20", textColor: "text-emerald-400", icon: CheckCircle2 },
                            { label: t("rejectedLabel"), value: requests.filter(r => r.status === "rejected").length, bgColor: "bg-red-500/20", textColor: "text-red-400", icon: XCircle },
                        ].map((s, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bgColor}`}>
                                            <s.icon className={`h-5 w-5 ${s.textColor}`} />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-display font-bold text-foreground tabular-nums">{s.value}</p>
                                            <p className="text-xs text-muted-foreground">{s.label}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="border-card-border bg-card">
                        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative flex-1 lg:max-w-sm">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={regularizationSearch}
                                    onChange={(e) => setRegularizationSearch(e.target.value)}
                                    placeholder={t("searchRegularization")}
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5" />{t("statusFilter")}</span>
                                {(["all", "pending", "approved", "rejected"] as const).map((value) => (
                                    <Button
                                        key={value}
                                        variant={regularizationStatusFilter === value ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setRegularizationStatusFilter(value)}
                                    >
                                        {value === "all" ? t("filterAll") : statusLabel(value)}
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Requests List */}
                    <div className="space-y-3">
                        {loadingReqs ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <Card key={i}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <Skeleton className="h-10 w-10 rounded-full" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-40" />
                                                <Skeleton className="h-3 w-60" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : filteredRequests.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center">
                                    <ClipboardEdit className="h-12 w-12 text-tertiary-foreground mx-auto mb-3" />
                                    <p className="text-muted-foreground">{t("noRequests")}</p>
                                    <p className="text-sm text-tertiary-foreground mt-1">
                                        {t("noRequestsDesc")}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            filteredRequests.map((req) => {
                                const config = statusConfig[req.status];
                                const StatusIcon = config.icon;
                                return (
                                    <Card key={req.id} className="hover:border-border transition-colors">
                                        <CardContent className="p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                                <Avatar className="h-10 w-10 shrink-0">
                                                    <AvatarFallback className="text-xs">
                                                        {req.employee.firstName[0]}{req.employee.lastName[0]}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground">
                                                        {req.employee.firstName} {req.employee.lastName}
                                                        <span className="text-muted-foreground ml-2">({req.employee.employeeCode})</span>
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {formatRegularizationDate(req.date)}
                                                        </span>
                                                        {req.requestedCheckIn && (
                                                            <span className="text-xs text-blue-400">In: {req.requestedCheckIn}</span>
                                                        )}
                                                        {req.requestedCheckOut && (
                                                            <span className="text-xs text-purple-400">Out: {req.requestedCheckOut}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{req.reason}</p>
                                                </div>

                                                <div className="flex flex-col gap-2 shrink-0 sm:items-end">
                                                    <Badge className={`${config.color} text-[10px]`}>
                                                        <StatusIcon className="h-3 w-3 mr-1" />
                                                        {statusLabel(req.status)}
                                                    </Badge>

                                                    {req.status === "pending" && (
                                                        <div className="flex flex-wrap gap-1.5 sm:justify-end">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                                                onClick={() => handleAction(req.id, "approve")}
                                                                disabled={processing === req.id}
                                                            >
                                                                {processing === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                                {t("approveAction")}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                                onClick={() => handleAction(req.id, "reject")}
                                                                disabled={processing === req.id}
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                                {t("rejectAction")}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
