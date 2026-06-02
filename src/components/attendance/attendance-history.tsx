"use client";

import { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { Shield, ShieldAlert, MapPin } from "lucide-react";

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
};

export function AttendanceHistory() {
    const t = useTranslations('Attendance');
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const formatDate = (value: string) => new Intl.DateTimeFormat(dateLocale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
    const formatTime = (value: string) => new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
    const statusLabel = (status: string) => {
        const labels: Record<string, string> = locale.startsWith("bn") ? { present: "উপস্থিত", late: "দেরিতে", absent: "অনুপস্থিত", half_day: "অর্ধদিবস" } : {};
        return labels[status] ?? status.replace('_', ' ');
    };
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch("/api/attendance?limit=10");
                if (res.ok) {
                    setHistory(await res.json());
                }
            } catch (error) {
                console.error("Failed to fetch history", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

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
                <CardTitle className="text-lg font-semibold text-foreground">{t('recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
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
                            {history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-tertiary-foreground">
                                        {t('noRecordsFound')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map((record) => {
                                    const gps = getGpsIndicator(record.notes);
                                    return (
                                        <TableRow key={record.id} className="border-card-border hover:bg-hover">
                                            <TableCell className="font-medium text-foreground">
                                                {formatDate(record.date)}
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
