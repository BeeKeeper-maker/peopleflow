"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Save,
    Play,
    Download,
    Table,
    BarChart,
    TrendingUp,
    PieChart,
    ChevronRight,
    Loader2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface FieldDef {
    key: string;
    label: string;
    type: string;
    groupable?: boolean;
}

interface DataSourceDef {
    label: string;
    fields: FieldDef[];
    filters: Array<{ key: string; label: string; type: string; options?: Array<{ value: string; label: string }> }>;
}

const CHART_TYPES = [
    { value: "table", label: "Table", icon: Table },
    { value: "bar", label: "Bar Chart", icon: BarChart },
    { value: "line", label: "Line Chart", icon: TrendingUp },
    { value: "pie", label: "Pie Chart", icon: PieChart },
];

export default function ReportBuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { addToast } = useToast();
    const [reportId, setReportId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [dataSource, setDataSource] = useState("employees");
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [groupBy, setGroupBy] = useState<string | null>(null);
    const [chartType, setChartType] = useState<string>("table");
    const [isShared, setIsShared] = useState(false);

    const [dsDef, setDsDef] = useState<DataSourceDef | null>(null);
    const [previewData, setPreviewData] = useState<{
        columns: Array<{ key: string; label: string; type: string }>;
        rows: Record<string, unknown>[];
        summary: Record<string, number>;
        total: number;
    } | null>(null);

    useEffect(() => {
        params.then((p) => {
            if (p.id !== "new") {
                setReportId(p.id);
                loadReport(p.id);
            } else {
                setLoading(false);
            }
        });
    }, [params]);

    useEffect(() => {
        // Load data source definition when dataSource changes
        loadDataSourceDef();
    }, [dataSource]);

    const loadReport = async (id: string) => {
        try {
            const res = await fetch(`/api/reports/custom/${id}`);
            if (res.ok) {
                const data = await res.json();
                setName(data.name);
                setDescription(data.description || "");
                setDataSource(data.dataSource);
                setSelectedFields(data.fields || []);
                setFilters((data.filters as Record<string, string>) || {});
                setGroupBy(data.groupBy);
                setChartType(data.chartType || "table");
                setIsShared(data.isShared);
            }
        } catch {
            addToast({ title: "Error", description: "Failed to load report", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const loadDataSourceDef = async () => {
        try {
            const res = await fetch(`/api/reports/custom?includeMeta=true&dataSource=${dataSource}`);
            if (res.ok) {
                const data = await res.json();
                setDsDef(data.dataSourceDefinition);
            }
        } catch {
            // ignore
        }
    };

    const toggleField = (key: string) => {
        setSelectedFields((prev) =>
            prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
        );
    };

    const handleSave = async () => {
        if (!name.trim()) {
            addToast({ title: "Error", description: "Name is required", type: "error" });
            return;
        }
        if (selectedFields.length === 0) {
            addToast({ title: "Error", description: "Select at least one field", type: "error" });
            return;
        }

        setSaving(true);
        try {
            const body = {
                name,
                description,
                dataSource,
                fields: selectedFields,
                filters,
                groupBy,
                chartType: chartType === "table" ? null : chartType,
                isShared,
            };

            const url = reportId ? `/api/reports/custom/${reportId}` : "/api/reports/custom";
            const method = reportId ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const saved = await res.json();
                addToast({ title: reportId ? "Report updated" : "Report created", type: "success" });
                if (!reportId) {
                    router.push(`/reports/builder/${saved.id}`);
                }
            } else {
                const err = await res.json();
                addToast({ title: "Error", description: err.error || "Failed to save", type: "error" });
            }
        } catch {
            addToast({ title: "Error", description: "Network error", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        if (selectedFields.length === 0) {
            addToast({ title: "Error", description: "Select at least one field", type: "error" });
            return;
        }

        setRunning(true);
        setPreviewData(null);

        try {
            // Save first if new report
            let execId = reportId;
            if (!execId) {
                const saveRes = await fetch("/api/reports/custom", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: name || "Untitled Report",
                        dataSource,
                        fields: selectedFields,
                        filters,
                        groupBy,
                        chartType: chartType === "table" ? null : chartType,
                        isShared,
                    }),
                });
                if (saveRes.ok) {
                    const saved = await saveRes.json();
                    execId = saved.id;
                    setReportId(execId);
                    router.replace(`/reports/builder/${execId}`);
                }
            } else {
                // Update existing before running
                await fetch(`/api/reports/custom/${execId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name,
                        description,
                        fields: selectedFields,
                        filters,
                        groupBy,
                        chartType: chartType === "table" ? null : chartType,
                        isShared,
                    }),
                });
            }

            const res = await fetch(`/api/reports/custom/${execId}/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format: "json", limit: 100 }),
            });

            if (res.ok) {
                const data = await res.json();
                setPreviewData(data.result);
                addToast({ title: `Report ran: ${data.result.total} rows`, type: "success" });
            }
        } catch {
            addToast({ title: "Error", description: "Failed to run report", type: "error" });
        } finally {
            setRunning(false);
        }
    };

    const handleExportCSV = async () => {
        if (!reportId) {
            addToast({ title: "Save the report first", type: "error" });
            return;
        }
        try {
            const res = await fetch(`/api/reports/custom/${reportId}/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format: "csv" }),
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${name || "report"}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch {
            addToast({ title: "Error", description: "Failed to export", type: "error" });
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold tabular-nums">
                        {reportId ? "Edit Report" : "New Custom Report"}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Select data source, fields, and filters to build your report.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportCSV} disabled={!reportId}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                    <Button variant="outline" onClick={handlePreview} disabled={running}>
                        {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                        Preview
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-[1fr_1fr] gap-6">
                {/* Left: Configuration */}
                <div className="space-y-4">
                    {/* Basic Info */}
                    <Card>
                        <CardHeader><CardTitle>Report Details</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <label className="text-sm font-medium">Name *</label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Monthly Attendance Summary"
                                    className="mt-1 bg-hover border-card-border"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Description</label>
                                <Input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What does this report show?"
                                    className="mt-1 bg-hover border-card-border"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Data Source</label>
                                <select
                                    value={dataSource}
                                    onChange={(e) => {
                                        setDataSource(e.target.value);
                                        setSelectedFields([]);
                                        setGroupBy(null);
                                    }}
                                    className="mt-1 w-full bg-hover border border-card-border rounded-md px-3 py-2"
                                >
                                    <option value="employees">Employees</option>
                                    <option value="attendance">Attendance</option>
                                    <option value="payroll">Payroll</option>
                                    <option value="leave">Leave Applications</option>
                                    <option value="expenses">Expense Claims</option>
                                    <option value="loans">Loans</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Chart Type</label>
                                <div className="grid grid-cols-4 gap-2 mt-1">
                                    {CHART_TYPES.map((ct) => {
                                        const Icon = ct.icon;
                                        return (
                                            <button
                                                key={ct.value}
                                                onClick={() => setChartType(ct.value)}
                                                className={`p-2 rounded-md border flex flex-col items-center gap-1 transition-colors ${
                                                    chartType === ct.value
                                                        ? "border-blue-500 bg-blue-500/10"
                                                        : "border-card-border hover:bg-hover/50"
                                                }`}
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span className="text-xs">{ct.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isShared}
                                    onChange={(e) => setIsShared(e.target.checked)}
                                    id="isShared"
                                />
                                <label htmlFor="isShared" className="text-sm">
                                    Share with other admins in this organization
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Field Picker */}
                    {dsDef && (
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Fields ({selectedFields.length} selected)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="max-h-64 overflow-y-auto space-y-1">
                                    {dsDef.fields.map((field) => (
                                        <label
                                            key={field.key}
                                            className="flex items-center gap-2 py-1 px-2 rounded hover:bg-hover/30 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedFields.includes(field.key)}
                                                onChange={() => toggleField(field.key)}
                                            />
                                            <span className="text-sm font-mono flex-1">{field.label}</span>
                                            <Badge variant="secondary" className="text-xs">{field.type}</Badge>
                                            {field.groupable && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setGroupBy(groupBy === field.key ? null : field.key);
                                                    }}
                                                    className={`text-xs px-2 py-0.5 rounded ${
                                                        groupBy === field.key
                                                            ? "bg-blue-600 text-white"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    group by
                                                </button>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right: Preview */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!previewData ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Click "Preview" to run the report</p>
                                </div>
                            ) : previewData.rows.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>No data found for the selected filters.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-card-border">
                                                {previewData.columns.map((col) => (
                                                    <th key={col.key} className="text-left py-2 px-2 font-medium">
                                                        {col.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.rows.slice(0, 50).map((row, i) => (
                                                <tr key={i} className="border-b border-card-border/50">
                                                    {previewData.columns.map((col) => (
                                                        <td key={col.key} className="py-1.5 px-2">
                                                            {formatCell(row[col.key], col.type)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                        {previewData.summary && Object.keys(previewData.summary).length > 0 && (
                                            <tfoot>
                                                <tr className="border-t-2 border-card-border font-medium">
                                                    <td className="py-2 px-2">Total / Summary</td>
                                                    {previewData.columns.slice(1).map((col) => (
                                                        <td key={col.key} className="py-2 px-2">
                                                            {previewData.summary[col.key] !== undefined
                                                                ? formatCell(previewData.summary[col.key], col.type)
                                                                : ""}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                    {previewData.total > 50 && (
                                        <p className="text-xs text-muted-foreground mt-2 text-center">
                                            Showing 50 of {previewData.total} rows
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function formatCell(value: unknown, type: string): string {
    if (value === null || value === undefined) return "—";
    if (type === "currency") {
        return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(Number(value));
    }
    if (type === "date" && value instanceof Date) {
        return value.toISOString().split("T")[0];
    }
    if (type === "date" && typeof value === "string") {
        return value.split("T")[0];
    }
    if (type === "boolean") {
        return value ? "Yes" : "No";
    }
    return String(value);
}
