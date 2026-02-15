"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
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
import { useTranslations } from "next-intl";

type AttendanceRecord = {
    id: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
};

export function AttendanceHistory() {
    const t = useTranslations('Attendance');
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
                                history.map((record) => (
                                    <TableRow key={record.id} className="border-card-border hover:bg-hover">
                                        <TableCell className="font-medium text-foreground">
                                            {format(new Date(record.date), "dd MMM yyyy")}
                                        </TableCell>
                                        <TableCell>
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
                                                {record.status.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-foreground">
                                            {record.checkIn ? format(new Date(record.checkIn), "hh:mm a") : "-"}
                                            {record.lateMinutes > 0 && (
                                                <span className="text-amber-500 text-xs ml-2">
                                                    (+{record.lateMinutes}m)
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-foreground">
                                            {record.checkOut ? format(new Date(record.checkOut), "hh:mm a") : "-"}
                                        </TableCell>
                                        <TableCell className="text-right text-foreground font-mono">
                                            {record.checkIn && record.checkOut
                                                ? ((new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / 3600000).toFixed(1) + "h"
                                                : "-"
                                            }
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
