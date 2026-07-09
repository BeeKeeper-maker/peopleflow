"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
    Building2,
    Users,
    Banknote,
    AlertTriangle,
    HandCoins,
    Clock,
    CalendarDays,
    Heart,
    ClipboardList,
    ClipboardCheck,
    ScrollText,
    ShieldCheck,
    ArrowLeft,
    Loader2,
    RefreshCw,
    Eye,
    FileText,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    STATUTORY_FORMS,
    type FormCode,
    type RegisterResult,
} from "@/lib/statutory-registers";
import { useStatutoryReports } from "@/hooks/use-data";

// ════════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════════

const FORM_ICONS: Record<FormCode, React.ComponentType<{ className?: string }>> = {
    A: Building2,
    B: Users,
    C: Banknote,
    D: AlertTriangle,
    E: HandCoins,
    F: Clock,
    G: CalendarDays,
    H: Heart,
    I: ClipboardList,
    J: ClipboardCheck,
    K: ScrollText,
};

const MONTH_NAMES_EN = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_BN = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

/** Forms that depend on the month/year selector (vs. all-time/historical). */
const DATE_SCOPED_FORMS = new Set<FormCode>(["C", "D", "E", "F", "G", "I"]);

// ════════════════════════════════════════════════════════════════════════
// Page Component
// ════════════════════════════════════════════════════════════════════════

export default function StatutoryRegistersPage() {
    const t = useTranslations("Statutory");
    const locale = useLocale();
    const isBn = locale.startsWith("bn");
    const monthNames = isBn ? MONTH_NAMES_BN : MONTH_NAMES_EN;

    const now = new Date();
    const [selectedForm, setSelectedForm] = useState<FormCode | null>(null);
    const [month, setMonth] = useState<number>(now.getMonth() + 1);
    const [year, setYear] = useState<number>(now.getFullYear());

    // ── TanStack Query: statutory register for the currently-selected form ──
    // The query is only enabled when the user has opened the dialog (selectedForm !== null).
    // The query key embeds form/month/year so switching any of those auto-refetches.
    const {
        data,
        isLoading: loading,
        isError,
        error: queryError,
        refetch,
    } = useStatutoryReports(selectedForm, month, year, selectedForm !== null);

    const errorMessage = isError
        ? (queryError instanceof Error ? queryError.message : "Failed to load register")
        : null;

    const handleOpen = (form: FormCode) => {
        setSelectedForm(form);
    };

    const handleClose = () => {
        setSelectedForm(null);
    };

    const handleRefresh = () => {
        void refetch();
    };

    const handleMonthYearChange = (m: number, y: number) => {
        setMonth(m);
        setYear(y);
        // The query auto-refetches because month/year are part of the query key.
    };

    const titleFor = (form: RegisterMeta): string => (isBn ? form.titleBn : form.titleEn);
    const descFor = (form: RegisterMeta): string => (isBn ? form.descriptionBn : form.descriptionEn);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                        <ShieldCheck className="h-7 w-7 text-blue-400" />
                        {t("title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
                </div>
                <Link href="/reports">
                    <Button variant="outline" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        {t("backToReports")}
                    </Button>
                </Link>
            </div>

            {/* Compliance banner */}
            <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-5 flex items-start gap-3">
                    <FileText className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                        <p className="font-medium text-foreground mb-1 font-display">
                            {t("bannerTitle")}
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            {t("bannerBody")}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Grid of 11 form cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {STATUTORY_FORMS.map((form) => {
                    const Icon = FORM_ICONS[form.form];
                    return (
                        <Card
                            key={form.form}
                            hoverable
                            className="flex flex-col"
                        >
                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                        <Icon className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base font-display flex items-center gap-2">
                                            <span className="text-blue-400">Form {form.form}</span>
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                                            {form.blaReference}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-foreground mb-1">
                                        {titleFor(form)}
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                        {descFor(form)}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full gap-2"
                                    onClick={() => handleOpen(form.form)}
                                >
                                    <Eye className="h-4 w-4" />
                                    {t("view")}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Detail Dialog */}
            <Dialog open={selectedForm !== null} onOpenChange={(open) => !open && handleClose()}>
                <DialogContent className="max-w-[90vw] sm:max-w-5xl h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="font-display text-lg flex items-center gap-2">
                            {selectedForm && (
                                <>
                                    <span className="text-blue-400">Form {selectedForm}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span>
                                        {(() => {
                                            const meta = STATUTORY_FORMS.find((f) => f.form === selectedForm);
                                            return meta ? titleFor(meta) : "";
                                        })()}
                                    </span>
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription className="flex items-center gap-2">
                            {selectedForm && (
                                <Badge variant="outline" className="font-mono text-xs">
                                    {STATUTORY_FORMS.find((f) => f.form === selectedForm)?.blaReference}
                                </Badge>
                            )}
                            <span>
                                {selectedForm &&
                                    descFor(STATUTORY_FORMS.find((f) => f.form === selectedForm)!)}
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-1 pb-2 border-b border-card-border">
                        {selectedForm && DATE_SCOPED_FORMS.has(selectedForm) && (
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-muted-foreground">
                                    {t("month")}
                                </label>
                                <select
                                    value={month}
                                    onChange={(e) => handleMonthYearChange(Number(e.target.value), year)}
                                    className="h-9 rounded-lg border border-card-border bg-card-bg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                >
                                    {monthNames.map((name, idx) => (
                                        <option key={idx} value={idx + 1}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                                <Input
                                    type="number"
                                    min={2000}
                                    max={2100}
                                    value={year}
                                    onChange={(e) => handleMonthYearChange(month, Number(e.target.value))}
                                    className="h-9 w-24"
                                />
                            </div>
                        )}
                        <div className="flex-1" />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={loading}
                            className="gap-2"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            {t("refresh")}
                        </Button>
                    </div>

                    {/* Body */}
                    <RegisterBody
                        loading={loading}
                        error={errorMessage}
                        data={data ?? null}
                        emptyLabel={t("noData")}
                        isBn={isBn}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════
// Register Body — renders summary cards + data table
// ════════════════════════════════════════════════════════════════════════

interface RegisterBodyProps {
    loading: boolean;
    error: string | null;
    data: RegisterResult | null;
    emptyLabel: string;
    isBn: boolean;
}

function RegisterBody({ loading, error, data, emptyLabel, isBn }: RegisterBodyProps) {
    if (loading) {
        return (
            <div className="flex-1 overflow-y-auto p-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-sm">
                    <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">{error}</p>
                    <p className="text-xs text-muted-foreground">{emptyLabel}</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const summaryEntries = Object.entries(data.summary);

    return (
        <div className="flex-1 overflow-y-auto p-1 space-y-4">
            {/* Summary chips */}
            {summaryEntries.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {summaryEntries.map(([key, value]) => (
                        <div
                            key={key}
                            className="rounded-xl border border-card-border bg-card-bg p-3"
                        >
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                                {prettifySummaryKey(key)}
                            </p>
                            <p className="text-lg font-semibold text-foreground font-display mt-1 truncate">
                                {formatSummaryValue(value, isBn)}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Data table */}
            {data.rows.length === 0 ? (
                <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
                    <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{emptyLabel}</p>
                </div>
            ) : (
                <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-card-border hover:bg-transparent">
                                {data.columns.map((col) => (
                                    <TableHead key={col.key} className="text-xs whitespace-nowrap">
                                        {col.label}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.rows.slice(0, 500).map((row, idx) => (
                                <TableRow key={idx} className="border-card-border">
                                    {data.columns.map((col) => (
                                        <TableCell
                                            key={col.key}
                                            className="text-xs whitespace-nowrap"
                                        >
                                            {formatCell(
                                                (row as Record<string, unknown>)[col.key],
                                                col.type,
                                                isBn,
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {data.rows.length > 500 && (
                        <div className="border-t border-card-border px-4 py-2 text-xs text-muted-foreground text-center">
                            {isBn
                                ? `প্রথম ৫০০টি সারি দেখানো হচ্ছে (মোট ${data.rows.length.toLocaleString()})`
                                : `Showing first 500 rows of ${data.rows.length.toLocaleString()}`}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════
// Formatting helpers
// ════════════════════════════════════════════════════════════════════════

function prettifySummaryKey(key: string): string {
    // camelCase → "Camel Case" with acronyms uppercased (OT, PF, BIN, TIN, EMI)
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
}

function formatSummaryValue(value: number | string, isBn: boolean): string {
    if (typeof value === "string") {
        // ISO date → readable
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
            try {
                const d = new Date(value);
                if (!Number.isNaN(d.getTime())) {
                    return d.toLocaleDateString(isBn ? "bn-BD" : "en-GB", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                    });
                }
            } catch {
                /* fall through */
            }
        }
        return value;
    }
    // Show BDT-formatted currency-ish numbers nicely
    if (Number.isFinite(value)) {
        return value.toLocaleString(isBn ? "bn-BD" : "en-US");
    }
    return String(value);
}

function formatCell(
    value: unknown,
    type: "string" | "number" | "currency" | "date" | "boolean",
    isBn: boolean,
): string {
    if (value === null || value === undefined) return "—";
    switch (type) {
        case "boolean":
            return value ? (isBn ? "হ্যাঁ" : "Yes") : (isBn ? "না" : "No");
        case "currency": {
            const n = typeof value === "number" ? value : Number(value);
            if (!Number.isFinite(n)) return "—";
            return `৳ ${n.toLocaleString(isBn ? "bn-BD" : "en-US", { maximumFractionDigits: 2 })}`;
        }
        case "number": {
            const n = typeof value === "number" ? value : Number(value);
            if (!Number.isFinite(n)) return "—";
            return n.toLocaleString(isBn ? "bn-BD" : "en-US");
        }
        case "date": {
            const s = String(value);
            try {
                const d = new Date(s);
                if (!Number.isNaN(d.getTime())) {
                    return d.toLocaleString(isBn ? "bn-BD" : "en-GB", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                    });
                }
            } catch {
                /* fall through */
            }
            return s;
        }
        case "string":
        default:
            return String(value);
    }
}

// Local RegisterMeta type alias to avoid importing the full interface inline.
type RegisterMeta = (typeof STATUTORY_FORMS)[number];
