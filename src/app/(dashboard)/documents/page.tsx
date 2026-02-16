"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/components/ui/toast";
import {
    FileText,
    Download,
    Eye,
    Printer,
    Loader2,
    ChevronRight,
    FileCheck,
    AlertCircle,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

interface DocumentTypeInfo {
    value: string;
    label: string;
    description: string;
    requiredFields: string[];
}

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    department?: { name: string };
    designation?: { name: string };
}

// ════════════════════════════════════════════════════════════════════════
// Template icons and colors
// ════════════════════════════════════════════════════════════════════════

const templateStyles: Record<string, { color: string; bgColor: string }> = {
    offer_letter: { color: "text-blue-400", bgColor: "bg-blue-500/20" },
    appointment_letter: { color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
    experience_certificate: { color: "text-purple-400", bgColor: "bg-purple-500/20" },
    increment_letter: { color: "text-amber-400", bgColor: "bg-amber-500/20" },
    warning_letter: { color: "text-red-400", bgColor: "bg-red-500/20" },
    termination_letter: { color: "text-rose-400", bgColor: "bg-rose-500/20" },
    salary_certificate: { color: "text-cyan-400", bgColor: "bg-cyan-500/20" },
    noc_letter: { color: "text-indigo-400", bgColor: "bg-indigo-500/20" },
};

// ════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════

export default function DocumentsPage() {
    const { addToast } = useToast();
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [docTypes, setDocTypes] = useState<DocumentTypeInfo[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    // Form state
    const [selectedType, setSelectedType] = useState<string>("");
    const [selectedEmployee, setSelectedEmployee] = useState<string>("");
    const [customData, setCustomData] = useState<Record<string, string>>({});
    const [generatedHTML, setGeneratedHTML] = useState<string>("");
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select, 2: Customize, 3: Preview

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [typesRes, empRes] = await Promise.all([
                fetch("/api/documents/generate"),
                fetch("/api/employees?limit=500"),
            ]);

            if (typesRes.ok) {
                const data = await typesRes.json();
                setDocTypes(data.documentTypes || []);
            }
            if (empRes.ok) {
                const data = await empRes.json();
                setEmployees(data.employees || []);
            }
        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    };

    const selectedTypeInfo = docTypes.find(d => d.value === selectedType);

    const handleGenerate = async () => {
        if (!selectedType || !selectedEmployee) {
            addToast({ title: "Missing fields", description: "Please select a document type and employee.", type: "error" });
            return;
        }

        setGenerating(true);
        try {
            const res = await fetch("/api/documents/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: selectedType,
                    employeeId: selectedEmployee,
                    customData,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to generate");
            }

            const data = await res.json();
            setGeneratedHTML(data.html);
            setStep(3);
            addToast({ title: "Document Generated", description: `${selectedTypeInfo?.label} created successfully.`, type: "success" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Something went wrong";
            addToast({ title: "Generation Failed", description: message, type: "error" });
        } finally {
            setGenerating(false);
        }
    };

    const handlePrint = () => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.print();
        }
    };

    const handleDownloadHTML = () => {
        const blob = new Blob([generatedHTML], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedType}_${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const employeeOptions = employees.map(e => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName} (${e.employeeCode})`,
    }));

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
                        <p className="text-muted-foreground mt-1">Generate official HR documents</p>
                    </div>
                    {step > 1 && (
                        <Button variant="outline" onClick={() => { setStep(1); setGeneratedHTML(""); }}>
                            ← Start Over
                        </Button>
                    )}
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-3">
                    {[
                        { num: 1, label: "Select Template" },
                        { num: 2, label: "Customize" },
                        { num: 3, label: "Preview & Download" },
                    ].map((s, i) => (
                        <div key={s.num} className="flex items-center gap-2">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${step >= s.num
                                ? "bg-blue-500 text-white"
                                : "bg-hover text-muted-foreground"
                                }`}>
                                {step > s.num ? "✓" : s.num}
                            </div>
                            <span className={`text-sm hidden sm:inline ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>
                                {s.label}
                            </span>
                            {i < 2 && <ChevronRight className="h-4 w-4 text-tertiary-foreground" />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Template Selection */}
                {step === 1 && (
                    <div className="space-y-6">
                        {/* Employee Selection */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Select Employee</CardTitle>
                                <CardDescription>Choose the employee for the document</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <Skeleton className="h-10 w-full rounded-lg" />
                                ) : (
                                    <SearchableSelect
                                        options={employeeOptions}
                                        value={selectedEmployee}
                                        onValueChange={setSelectedEmployee}
                                        placeholder="Search employee by name or code..."
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* Template Grid */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Choose Document Type</CardTitle>
                                <CardDescription>Select the type of document to generate</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {Array.from({ length: 8 }).map((_, i) => (
                                            <Skeleton key={i} className="h-32 rounded-xl" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {docTypes.map((doc) => {
                                            const style = templateStyles[doc.value] || { color: "text-blue-400", bgColor: "bg-blue-500/20" };
                                            const isSelected = selectedType === doc.value;
                                            return (
                                                <button
                                                    key={doc.value}
                                                    onClick={() => setSelectedType(doc.value)}
                                                    className={`p-4 rounded-xl text-left transition-all duration-200 border ${isSelected
                                                        ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50"
                                                        : "border-card-border bg-hover hover:bg-card hover:-translate-y-0.5"
                                                        }`}
                                                >
                                                    <div className={`h-10 w-10 rounded-lg ${style.bgColor} flex items-center justify-center mb-3`}>
                                                        <FileText className={`h-5 w-5 ${style.color}`} />
                                                    </div>
                                                    <h3 className="text-sm font-medium text-foreground">{doc.label}</h3>
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.description}</p>
                                                    {isSelected && (
                                                        <Badge className="mt-2" variant="info">Selected</Badge>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Next Button */}
                        <div className="flex justify-end">
                            <Button
                                onClick={() => {
                                    if (!selectedEmployee) {
                                        addToast({ title: "Select Employee", description: "Please select an employee first.", type: "error" });
                                        return;
                                    }
                                    if (!selectedType) {
                                        addToast({ title: "Select Template", description: "Please select a document type.", type: "error" });
                                        return;
                                    }
                                    setStep(2);
                                }}
                                className="gap-2"
                                disabled={!selectedType || !selectedEmployee}
                            >
                                Next: Customize <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Customize */}
                {step === 2 && selectedTypeInfo && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileCheck className="h-5 w-5 text-blue-400" />
                                    Customize: {selectedTypeInfo.label}
                                </CardTitle>
                                <CardDescription>
                                    Fill in any additional fields. Employee data is auto-populated.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {selectedTypeInfo.requiredFields && selectedTypeInfo.requiredFields.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {selectedTypeInfo.requiredFields.map((field) => (
                                            <div key={field} className="space-y-2">
                                                <Label className="capitalize">{field.replace(/([A-Z])/g, " $1").trim()}</Label>
                                                <Input
                                                    value={customData[field] || ""}
                                                    onChange={(e) => setCustomData({ ...customData, [field]: e.target.value })}
                                                    placeholder={`Enter ${field.replace(/([A-Z])/g, " $1").toLowerCase().trim()}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <FileCheck className="h-5 w-5 text-emerald-400" />
                                        <p className="text-sm text-emerald-300">All required data will be auto-populated from the employee record. No additional customization needed.</p>
                                    </div>
                                )}

                                {/* Common optional fields */}
                                <div className="mt-6 pt-6 border-t border-card-border">
                                    <h4 className="text-sm font-medium text-foreground mb-4">Optional Overrides</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Document Date</Label>
                                            <Input
                                                type="date"
                                                value={customData.date || ""}
                                                onChange={(e) => setCustomData({ ...customData, date: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Reference Number</Label>
                                            <Input
                                                value={customData.referenceNumber || ""}
                                                onChange={(e) => setCustomData({ ...customData, referenceNumber: e.target.value })}
                                                placeholder="e.g. HR/2026/001"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                                Generate & Preview
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Preview */}
                {step === 3 && generatedHTML && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Eye className="h-5 w-5 text-blue-400" />
                                        Document Preview
                                    </CardTitle>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={handleDownloadHTML} className="gap-2">
                                            <Download className="h-4 w-4" /> HTML
                                        </Button>
                                        <Button size="sm" onClick={handlePrint} className="gap-2">
                                            <Printer className="h-4 w-4" /> Print / PDF
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-xl overflow-hidden border border-card-border bg-white">
                                    <iframe
                                        ref={iframeRef}
                                        srcDoc={generatedHTML}
                                        className="w-full min-h-[700px]"
                                        title="Document Preview"
                                        sandbox="allow-same-origin"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <AlertCircle className="h-5 w-5 text-blue-400 shrink-0" />
                            <p className="text-sm text-blue-300">
                                Use <strong>&quot;Print / PDF&quot;</strong> to save as PDF. In the print dialog, select &quot;Save as PDF&quot; as the destination.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
