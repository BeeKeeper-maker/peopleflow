"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
    Upload,
    Download,
    CheckCircle2,
    XCircle,
    Loader2,
    FileSpreadsheet,
    Users,
    ArrowLeft,
} from "lucide-react";

interface ImportRow {
    rowNumber: number;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    department: string;
    designation: string;
    joiningDate: string;
    employmentType: string;
    gender: string;
    errors: string[];
}

interface ImportResult {
    total: number;
    valid: number;
    invalid: number;
    created: number;
    failed: number;
    preview: {
        validRows: ImportRow[];
        invalidRows: ImportRow[];
    };
}

const TEMPLATE_CSV =
    "employeeCode,firstName,lastName,email,phone,department,designation,joiningDate,employmentType,gender\n" +
    "EMP001,John,Doe,john@example.com,01712345678,Engineering,Software Engineer,2024-01-15,permanent,male\n" +
    "EMP002,Jane,Smith,jane@example.com,01812345678,HR,HR Manager,2024-02-01,permanent,female";

export default function ImportEmployeesPage() {
    const { addToast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/employees/bulk-import", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                setResult(data as ImportResult);
                addToast({
                    title: `${data.valid} valid, ${data.invalid} invalid rows found`,
                    type: data.invalid > 0 ? "warning" : "success",
                });
            } else {
                addToast({
                    title: data.error || "Import failed",
                    type: "error",
                });
            }
        } catch {
            addToast({ title: "Network error", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!file) return;
        setConfirming(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("confirm", "true");
            const res = await fetch("/api/employees/bulk-import", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                addToast({
                    title: `${data.created} employees imported successfully`,
                    type: "success",
                });
                setResult(null);
                setFile(null);
            } else {
                addToast({
                    title: data.error || "Import failed",
                    type: "error",
                });
            }
        } catch {
            addToast({ title: "Network error", type: "error" });
        } finally {
            setConfirming(false);
        }
    };

    const downloadTemplate = () => {
        const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "employee-import-template.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Import Employees"
                subtitle="Bulk import employees from a CSV file"
                icon={Users}
                iconColor="primary"
                actions={
                    <Link href="/employees">
                        <Button variant="outline" className="gap-2 border-card-border">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                }
            />

            {/* Upload Card */}
            <Card className="border-card-border bg-card-bg">
                <CardContent className="p-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">
                                    Upload CSV File
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Max 1000 rows per import. Required columns: employeeCode,
                                    firstName, lastName, joiningDate.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={downloadTemplate}
                                className="gap-2 border-card-border"
                            >
                                <Download className="h-4 w-4" />
                                Download Template
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            <label className="flex-1 cursor-pointer">
                                <div className="flex items-center gap-3 rounded-xl border border-dashed border-card-border bg-hover/50 p-4 hover:bg-hover transition-colors">
                                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            {file
                                                ? file.name
                                                : "Click to select CSV file"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {file
                                                ? `${(file.size / 1024).toFixed(1)} KB`
                                                : "Supported: .csv"}
                                        </p>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                            <Button
                                onClick={handleUpload}
                                disabled={!file || loading}
                                className="gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="h-4 w-4" />
                                )}
                                Preview
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {result && (
                <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Card className="border-blue-500/20">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">Total Rows</p>
                                <p className="text-2xl font-display font-bold text-foreground mt-1 tabular-nums">
                                    {result.total}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-emerald-500/20">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">Valid</p>
                                <p className="text-2xl font-display font-bold text-emerald-400 mt-1 tabular-nums">
                                    {result.valid}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-red-500/20">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">Invalid</p>
                                <p className="text-2xl font-display font-bold text-red-400 mt-1 tabular-nums">
                                    {result.invalid}
                                </p>
                            </CardContent>
                        </Card>
                        {result.created > 0 && (
                            <Card className="border-emerald-500/20">
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">Created</p>
                                    <p className="text-2xl font-display font-bold text-emerald-400 mt-1 tabular-nums">
                                        {result.created}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Confirm Button */}
                    {result.valid > 0 && result.created === 0 && (
                        <div className="flex justify-end">
                            <Button
                                onClick={handleConfirm}
                                disabled={confirming}
                                className="gap-2 bg-blue-600 hover:bg-blue-700"
                            >
                                {confirming ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                Import {result.valid} Employees
                            </Button>
                        </div>
                    )}

                    {/* Invalid Rows */}
                    {result.preview.invalidRows.length > 0 && (
                        <Card className="border-red-500/20">
                            <CardContent className="p-4">
                                <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                                    <XCircle className="h-4 w-4" />
                                    Invalid Rows ({result.preview.invalidRows.length})
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-card-border text-left text-xs text-muted-foreground">
                                                <th className="pb-2 pr-3">Row</th>
                                                <th className="pb-2 pr-3">Code</th>
                                                <th className="pb-2 pr-3">Name</th>
                                                <th className="pb-2 pr-3">Errors</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.preview.invalidRows.map((row) => (
                                                <tr
                                                    key={row.rowNumber}
                                                    className="border-b border-card-border/50"
                                                >
                                                    <td className="py-2 pr-3 text-muted-foreground">
                                                        {row.rowNumber}
                                                    </td>
                                                    <td className="py-2 pr-3 font-mono text-foreground">
                                                        {row.employeeCode}
                                                    </td>
                                                    <td className="py-2 pr-3 text-foreground">
                                                        {row.firstName} {row.lastName}
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        {row.errors.map((err, i) => (
                                                            <Badge
                                                                key={i}
                                                                variant="danger"
                                                                className="mr-1 mb-1"
                                                            >
                                                                {err}
                                                            </Badge>
                                                        ))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Valid Rows */}
                    {result.preview.validRows.length > 0 && (
                        <Card className="border-emerald-500/20">
                            <CardContent className="p-4">
                                <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Valid Rows ({result.preview.validRows.length}
                                    {result.valid > 100 ? ", showing first 100" : ""})
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-card-border text-left text-xs text-muted-foreground">
                                                <th className="pb-2 pr-3">Row</th>
                                                <th className="pb-2 pr-3">Code</th>
                                                <th className="pb-2 pr-3">Name</th>
                                                <th className="pb-2 pr-3">Email</th>
                                                <th className="pb-2 pr-3">Phone</th>
                                                <th className="pb-2 pr-3">Dept</th>
                                                <th className="pb-2 pr-3">Designation</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.preview.validRows.map((row) => (
                                                <tr
                                                    key={row.rowNumber}
                                                    className="border-b border-card-border/50"
                                                >
                                                    <td className="py-2 pr-3 text-muted-foreground">
                                                        {row.rowNumber}
                                                    </td>
                                                    <td className="py-2 pr-3 font-mono text-foreground">
                                                        {row.employeeCode}
                                                    </td>
                                                    <td className="py-2 pr-3 text-foreground">
                                                        {row.firstName} {row.lastName}
                                                    </td>
                                                    <td className="py-2 pr-3 text-muted-foreground">
                                                        {row.email}
                                                    </td>
                                                    <td className="py-2 pr-3 text-muted-foreground">
                                                        {row.phone}
                                                    </td>
                                                    <td className="py-2 pr-3 text-muted-foreground">
                                                        {row.department}
                                                    </td>
                                                    <td className="py-2 pr-3 text-muted-foreground">
                                                        {row.designation}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
