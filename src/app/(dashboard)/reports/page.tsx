"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart3,
    Plus,
    Save,
    Play,
    Download,
    Trash2,
    Share2,
    Clock,
    Table,
    BarChart,
    TrendingUp,
    PieChart,
} from "lucide-react";
import Link from "next/link";

interface SavedReport {
    id: string;
    name: string;
    description: string | null;
    dataSource: string;
    fields: string[];
    chartType: string | null;
    isShared: boolean;
    updatedAt: string;
    _count?: { schedules: number };
}

export default function ReportsListPage() {
    const { addToast } = useToast();
    const t = useTranslations("Reports");
    const { confirm, dialog: confirmDialog } = useConfirmDialog();
    const [reports, setReports] = useState<SavedReport[]>([]);
    const [loading, setLoading] = useState(true);

    const dataSourceLabel = (key: string): string => {
        const map: Record<string, string> = {
            employees: t("employee"),
            attendance: t("attendanceTab"),
            payroll: t("payrollReport"),
            leave: t("leaveReport"),
            expenses: t("title"),
            loans: t("title"),
        };
        return map[key] || key;
    };

    const fetchReports = useCallback(async () => {
        try {
            const res = await fetch("/api/reports/custom");
            if (res.ok) {
                const data = await res.json();
                setReports(data.data || []);
            }
        } catch {
            addToast({ title: t("error"), description: t("failedLoadReports"), type: "error" });
        } finally {
            setLoading(false);
        }
    }, [addToast, t]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleDelete = async (id: string, name: string) => {
        const ok = await confirm({
            title: `${t("delete")} "${name}"?`,
            description: t("cannotUndo"),
            confirmLabel: t("delete"),
            variant: "destructive",
        });
        if (!ok) return;
        try {
            await fetch(`/api/reports/custom/${id}`, { method: "DELETE" });
            addToast({ title: t("reportDeleted"), type: "success" });
            fetchReports();
        } catch {
            addToast({ title: t("error"), description: t("failedDelete"), type: "error" });
        }
    };

    const chartIcon = (type: string | null) => {
        switch (type) {
            case "bar": return <BarChart className="h-4 w-4" />;
            case "line": return <TrendingUp className="h-4 w-4" />;
            case "pie": return <PieChart className="h-4 w-4" />;
            default: return <Table className="h-4 w-4" />;
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">{t("loading")}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <BarChart3 className="h-6 w-6" />
                        {t("customReports")}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {t("customReportsDesc")}
                    </p>
                </div>
                <Link href="/reports/builder/new">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" />
                        {t("newReport")}
                    </Button>
                </Link>
            </div>

            {reports.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">{t("noCustomReports")}</p>
                        <p className="text-sm text-muted-foreground mt-1 mb-4">
                            {t("noCustomReportsDesc")}
                        </p>
                        <Link href="/reports/builder/new">
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="h-4 w-4 mr-2" />
                                {t("createReport")}
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {reports.map((report) => (
                        <Card key={report.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                                <div className="flex items-center gap-3">
                                    {chartIcon(report.chartType)}
                                    <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            {report.name}
                                            {report.isShared && (
                                                <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30">
                                                    <Share2 className="h-3 w-3 mr-1" />
                                                    {t("shared")}
                                                </Badge>
                                            )}
                                            {report._count?.schedules ? (
                                                <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    {t("scheduled")}
                                                </Badge>
                                            ) : null}
                                        </CardTitle>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            <span>{dataSourceLabel(report.dataSource)}</span>
                                            <span>·</span>
                                            <span>{report.fields.length} {t("fields")}</span>
                                            {report.description && (
                                                <>
                                                    <span>·</span>
                                                    <span className="truncate max-w-xs">{report.description}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Link href={`/reports/builder/${report.id}`}>
                                        <Button variant="ghost" size="icon" title={t("edit")}>
                                            <Save className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        title={t("delete")}
                                        onClick={() => handleDelete(report.id, report.name)}
                                        className="text-red-400 hover:text-red-300"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}
            {confirmDialog}
        </div>
    );
}
