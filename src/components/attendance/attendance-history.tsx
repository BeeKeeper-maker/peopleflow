"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Clock, Download, Fingerprint, Filter, MapPin, RefreshCw, Search, Shield, ShieldAlert } from "lucide-react";

type AttendanceRecord = {
    id: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    notes: string | null;
    source: string | null;
    employee?: {
        firstName: string;
        lastName: string;
        employeeCode: string;
    };
};

export function AttendanceHistory() {
    const t = useTranslations('Attendance');
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const formatDate = (value: string) => new Intl.DateTimeFormat(dateLocale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
    const formatTime = (value: string) => new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
    const sourceLabel = (source: string | null) => {
        if (source === "biometric") return t("sourceBiometric");
        if (source === "manual") return t("sourceManual");
        if (source === "regularization") return t("sourceRegularization");
        if (source === "web") return t("sourceWeb");
        return source || t("sourceUnknown");
    };
    const statusLabel = (status: string) => {
        const labels: Record<string, string> = locale.startsWith("bn") ? { present: "উপস্থিত", late: "দেরিতে", absent: "অনুপস্থিত", half_day: "অর্ধদিবস" } : {};
        return labels[status] ?? status.replace('_', ' ');
    };
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [sourceFilter, setSourceFilter] = useState<"all" | "biometric" | "web" | "manual" | "regularization">("all");
    const [search, setSearch] = useState("");

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/attendance?limit=50");
            if (res.ok) {
                setHistory(await res.json());
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const filteredHistory = useMemo(() => {
        const q = search.trim().toLowerCase();
        return history.filter((record) => {
            if (sourceFilter !== "all" && record.source !== sourceFilter) return false;
            if (!q) return true;
            const employeeText = record.employee
                ? `${record.employee.firstName} ${record.employee.lastName} ${record.employee.employeeCode}`.toLowerCase()
                : "";
            return employeeText.includes(q) || record.status.toLowerCase().includes(q) || (record.source || "").toLowerCase().includes(q);
        });
    }, [history, search, sourceFilter]);

    const biometricCount = history.filter((r) => r.source === "biometric").length;
    const openShiftCount = history.filter((r) => r.checkIn && !r.checkOut).length;
    const exceptionCount = history.filter((r) => r.lateMinutes > 0 || r.status === "absent" || r.status === "half_day").length;

    const exportAttendance = () => {
        const params = new URLSearchParams();
        if (sourceFilter !== "all") params.set("source", sourceFilter);
        window.location.href = `/api/attendance/export${params.toString() ? `?${params.toString()}` : ""}`;
    };

    // Parse GPS status from notes
    const getGpsIndicator = (notes: string | null) => {
        if (!notes) return null;
        if (notes.includes("✅") || notes.includes("within geo-fence")) {
            return { status: "inside", icon: Shield, color: "text-emerald-400" };
        }
        if (notes.includes("⚠️") || notes.includes("outside geo-fence")) {
            return { status: "outside", icon: ShieldAlert, color: "text-amber-400" };
        }
        return null;
    };

    if (loading) {
        return <div className="h-48 animate-pulse bg-hover rounded-xl border border-card-border" />;
    }

    return (
        <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <CardTitle className="text-lg font-semibold text-foreground">{t('recentActivity')}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{t("attendanceHistoryHelp")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 self-start lg:self-auto">
                        <Button variant="outline" size="sm" onClick={exportAttendance} className="gap-2">
                            <Download className="h-3.5 w-3.5" />
                            {t("exportCsv")}
                        </Button>
                        <Button variant="outline" size="sm" onClick={fetchHistory} className="gap-2">
                            <RefreshCw className="h-3.5 w-3.5" />
                            {t("refresh")}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 px-0">
                <div className="grid gap-3 sm:grid-cols-3">
                    {[
                        { icon: Fingerprint, label: t("biometricPunches"), value: biometricCount, tone: "text-cyan-400 bg-cyan-500/10" },
                        { icon: Clock, label: t("openShifts"), value: openShiftCount, tone: "text-amber-400 bg-amber-500/10" },
                        { icon: AlertTriangle, label: t("exceptions"), value: exceptionCount, tone: "text-red-400 bg-red-500/10" },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="rounded-xl border border-card-border bg-hover p-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", item.tone)}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-display font-bold text-foreground">{item.value}</p>
                                        <p className="text-xs text-muted-foreground">{item.label}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-card-border bg-hover p-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative flex-1 lg:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t("searchEmployeeAttendance")}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5" />{t("source")}</span>
                        {[
                            ["all", t("filterAll")],
                            ["biometric", t("sourceBiometric")],
                            ["web", t("sourceWeb")],
                            ["manual", t("sourceManual")],
                            ["regularization", t("sourceRegularization")],
                        ].map(([value, label]) => (
                            <Button
                                key={String(value)}
                                variant={sourceFilter === value ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSourceFilter(value as typeof sourceFilter)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>
                <div className="rounded-xl border border-card-border bg-hover overflow-hidden">
                    <Table>
                        <TableHeader className="bg-hover">
                            <TableRow className="border-card-border hover:bg-hover">
                                <TableHead className="text-muted-foreground">{t('date')}</TableHead>
                                <TableHead className="text-muted-foreground">{t('status')}</TableHead>
                                <TableHead className="text-muted-foreground">{t('checkIn')}</TableHead>
                                <TableHead className="text-muted-foreground">{t('checkOut')}</TableHead>
                                <TableHead className="text-muted-foreground text-right">{t('hours')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredHistory.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-tertiary-foreground">
                                        {t('noRecordsFound')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredHistory.map((record) => {
                                    const gps = getGpsIndicator(record.notes);
                                    return (
                                        <TableRow key={record.id} className="border-card-border hover:bg-hover">
                                            <TableCell className="font-medium text-foreground">
                                                <div>{formatDate(record.date)}</div>
                                                {record.employee && (
                                                    <div className="mt-1 text-xs font-normal text-muted-foreground">
                                                        {record.employee.firstName} {record.employee.lastName} · {record.employee.employeeCode}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "border-0",
                                                            record.status === 'present' && "bg-emerald-500/10 text-emerald-500",
                                                            record.status === 'late' && "bg-amber-500/10 text-amber-500",
                                                            record.status === 'absent' && "bg-red-500/10 text-red-500",
                                                            record.status === 'half_day' && "bg-blue-500/10 text-blue-500",
                                                        )}
                                                    >
                                                        {statusLabel(record.status)}
                                                    </Badge>
                                                    {record.source && (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "border-0 gap-1 text-xs",
                                                                record.source === "biometric"
                                                                    ? "bg-cyan-500/10 text-cyan-400"
                                                                    : "bg-zinc-500/10 text-zinc-400"
                                                            )}
                                                        >
                                                            {record.source === "biometric" ? <Fingerprint className="h-3 w-3" /> : null}
                                                            {sourceLabel(record.source)}
                                                        </Badge>
                                                    )}
                                                    {/* GPS indicator */}
                                                    {gps && (
                                                        <span title={gps.status === "inside" ? "GPS: Office-এর মধ্যে" : "GPS: Office-এর বাইরে"}>
                                                            <gps.icon className={cn("h-3.5 w-3.5", gps.color)} />
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-foreground">
                                                <div className="flex items-center gap-1">
                                                    {record.checkIn ? formatTime(record.checkIn) : "-"}
                                                    {record.lateMinutes > 0 && (
                                                        <span className="text-amber-500 text-xs">
                                                            ({locale.startsWith("bn") ? `+${record.lateMinutes} মি.` : `+${record.lateMinutes}m`})
                                                        </span>
                                                    )}
                                                    {record.source === "web" && record.checkIn && (
                                                        <span title="Web GPS check-in">
                                                            <MapPin className="h-3 w-3 text-blue-400 ml-0.5" />
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-foreground">
                                                {record.checkOut ? formatTime(record.checkOut) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right text-foreground font-mono">
                                                {record.checkIn && record.checkOut
                                                    ? ((new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / 3600000).toFixed(1) + (locale.startsWith("bn") ? " ঘন্টা" : "h")
                                                    : "-"
                                                }
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
