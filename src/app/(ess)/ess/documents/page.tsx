"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
    FileText,
    Download,
    Loader2,
    ScrollText,
    Award,
    ShieldCheck,
    Briefcase,
    AlertTriangle,
    FileCheck,
    Clock,
    CheckCircle2,
    XCircle,
    RefreshCw,
} from "lucide-react";

interface DocumentRequest {
    id: string;
    type: string;
    status: string;
    documentUrl?: string;
    rejectionNote?: string;
    createdAt: string;
    processedAt?: string;
}

// Document types matching the API's VALID_DOC_TYPES exactly
const documentTypes = [
    { value: "offer_letter", icon: ScrollText, color: "from-blue-500 to-indigo-600" },
    { value: "salary_certificate", icon: FileCheck, color: "from-green-500 to-emerald-600" },
    { value: "experience_certificate", icon: Award, color: "from-purple-500 to-violet-600" },
    { value: "noc_letter", icon: ShieldCheck, color: "from-amber-500 to-orange-600" },
    { value: "appointment_letter", icon: Briefcase, color: "from-cyan-500 to-blue-600" },
    { value: "increment_letter", icon: FileText, color: "from-pink-500 to-rose-600" },
];

const labelMap: Record<string, string> = {
    offer_letter: "offerLetter",
    salary_certificate: "salaryCertificate",
    experience_certificate: "experienceCertificate",
    noc_letter: "nocLetter",
    appointment_letter: "appointmentLetter",
    increment_letter: "incrementLetter",
};

const requestStatusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    pending: { color: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: Clock },
    processing: { color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: RefreshCw },
    ready: { color: "bg-green-500/15 text-green-400 border-green-500/20", icon: CheckCircle2 },
    rejected: { color: "bg-red-500/15 text-red-400 border-red-500/20", icon: XCircle },
};

export default function ESSDocumentsPage() {
    const t = useTranslations("ESSDocuments");
    const { addToast } = useToast();
    const [generating, setGenerating] = useState<string | null>(null);
    const [myRequests, setMyRequests] = useState<DocumentRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);

    // Fetch previous document requests
    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const res = await fetch("/api/ess/document-request");
                if (res.ok) {
                    const data = await res.json();
                    setMyRequests(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error("Failed to fetch document requests:", err);
            } finally {
                setLoadingRequests(false);
            }
        };

        fetchRequests();
    }, []);

    const handleGenerate = async (docType: string) => {
        setGenerating(docType);

        try {
            const res = await fetch("/api/ess/document-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: docType }),
            });

            if (res.ok) {
                const data = await res.json();

                // Add the new request to the list
                if (data.request) {
                    setMyRequests(prev => [data.request, ...prev]);
                }

                if (data.html) {
                    addToast({ type: "success", title: t("requestSuccess") });
                    // Open in new window for printing/downloading
                    const printWindow = window.open("", "_blank");
                    if (printWindow) {
                        printWindow.document.write(data.html);
                        printWindow.document.close();
                    }
                } else {
                    addToast({
                        type: "success",
                        title: t("requestSubmitted"),
                    });
                }
            } else {
                const errData = await res.json().catch(() => null);
                addToast({
                    type: "error",
                    title: t("requestFailed"),
                    description: errData?.error,
                });
            }
        } catch {
            addToast({ type: "error", title: t("requestFailed") });
        } finally {
            setGenerating(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
                <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-300/80">{t("documentNote")}</p>
            </div>

            {/* Document types grid — Request New */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">{t("requestDocument")}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documentTypes.map(doc => {
                        const DocIcon = doc.icon;
                        const isGenerating = generating === doc.value;

                        return (
                            <Card key={doc.value} className="bg-card-bg border-card-border hover:border-primary/20 transition-all group">
                                <CardContent className="p-6">
                                    <div className="flex flex-col items-center text-center space-y-4">
                                        <div className={cn(
                                            "w-14 h-14 rounded-2xl bg-linear-to-br flex items-center justify-center transition-transform group-hover:scale-110",
                                            doc.color
                                        )}>
                                            <DocIcon className="h-7 w-7 text-white" />
                                        </div>

                                        <div>
                                            <h3 className="font-semibold text-foreground">
                                                {t(labelMap[doc.value] as any)}
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t("documentType")}
                                            </p>
                                        </div>

                                        <Button
                                            onClick={() => handleGenerate(doc.value)}
                                            disabled={isGenerating}
                                            className="w-full"
                                            size="sm"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    {t("generating")}
                                                </>
                                            ) : (
                                                <>
                                                    <FileText className="h-4 w-4" />
                                                    {t("requestDocument")}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* My Previous Requests — backed by DocumentRequest model */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">{t("myRequests")}</h2>

                {loadingRequests ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : myRequests.length === 0 ? (
                    <Card className="bg-card-bg border-card-border">
                        <CardContent className="py-12 text-center">
                            <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                                <FileText className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <h3 className="text-base font-semibold text-foreground mb-1">{t("noDocuments")}</h3>
                            <p className="text-muted-foreground text-sm">{t("noDocumentsDesc")}</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {myRequests.map(req => {
                            const statusConf = requestStatusConfig[req.status] || requestStatusConfig.pending;
                            const StatusIcon = statusConf.icon;
                            const docLabelKey = labelMap[req.type];

                            return (
                                <Card key={req.id} className="bg-card-bg border-card-border">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-5 w-5 text-primary shrink-0" />
                                                <div>
                                                    <p className="font-medium text-foreground text-sm">
                                                        {docLabelKey ? t(docLabelKey as any) : req.type}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {t("requestedOn")} {new Date(req.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border",
                                                    statusConf.color
                                                )}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {t(req.status as any)}
                                                </span>
                                                {req.status === "ready" && (
                                                    <Button variant="outline" size="sm" className="h-7 text-xs">
                                                        <Download className="h-3.5 w-3.5" />
                                                        {t("download")}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {req.rejectionNote && (
                                            <p className="mt-2 text-xs text-red-400 pl-8">{req.rejectionNote}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
