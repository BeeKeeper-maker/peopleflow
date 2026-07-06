"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ShieldCheck,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    Loader2,
    Info,
    Banknote,
    Calendar,
    Users,
    Shield,
    FileText,
    ArrowRight,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

interface ComplianceCheck {
    id: string;
    category: string;
    rule: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low";
    status: "pass" | "fail" | "warning";
    affectedCount: number;
    details?: string;
}

interface ComplianceCategory {
    name: string;
    icon: any;
    total: number;
    passed: number;
    failed: number;
    score: number;
}

// ════════════════════════════════════════════════════════════════════════
// Severity Config
// ════════════════════════════════════════════════════════════════════════

const severityConfig = {
    critical: { label: "Critical", color: "bg-red-500/20 text-red-400", borderColor: "border-red-500/30" },
    high: { label: "High", color: "bg-orange-500/20 text-orange-400", borderColor: "border-orange-500/30" },
    medium: { label: "Medium", color: "bg-amber-500/20 text-amber-400", borderColor: "border-amber-500/30" },
    low: { label: "Low", color: "bg-blue-500/20 text-blue-400", borderColor: "border-blue-500/30" },
};
// Bengali labels (used when locale is bn)
const severityLabelsBn: Record<string, string> = {
    critical: "সংকটজনক",
    high: "উচ্চ",
    medium: "মাঝারি",
    low: "নিম্ন",
};

const statusIcons = {
    pass: CheckCircle2,
    fail: XCircle,
    warning: AlertTriangle,
};

const statusColors = {
    pass: "text-emerald-400",
    fail: "text-red-400",
    warning: "text-amber-400",
};

// ════════════════════════════════════════════════════════════════════════
// Compliance Score Ring
// ════════════════════════════════════════════════════════════════════════

function ScoreRing({ score, size = 180, label, sublabel }: { score: number; size?: number; label: string; sublabel: string }) {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const fill = (score / 100) * circumference;

    const getColor = (s: number) => {
        if (s >= 80) return "#10B981";
        if (s >= 60) return "#F59E0B";
        return "#EF4444";
    };

    const color = getColor(score);

    return (
        <svg viewBox="0 0 180 180" style={{ width: size, height: size }}>
            {/* Background ring */}
            <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
            {/* Score ring */}
            <circle
                cx="90" cy="90" r={radius} fill="none"
                stroke={color} strokeWidth="12"
                strokeDasharray={`${fill} ${circumference - fill}`}
                strokeLinecap="round"
                transform="rotate(-90 90 90)"
                className="transition-all duration-1000"
            />
            {/* Glow */}
            <circle
                cx="90" cy="90" r={radius} fill="none"
                stroke={color} strokeWidth="12"
                strokeDasharray={`${fill} ${circumference - fill}`}
                strokeLinecap="round"
                transform="rotate(-90 90 90)"
                opacity="0.3"
                filter="blur(4px)"
            />
            {/* Score text */}
            <text x="90" y="80" textAnchor="middle" className="fill-foreground text-[32px] font-bold">{score}%</text>
            <text x="90" y="103" textAnchor="middle" className="fill-muted-foreground text-[12px]">{label}</text>
            <text x="90" y="118" textAnchor="middle" className="fill-muted-foreground text-[10px]">{sublabel}</text>
        </svg>
    );
}

// ════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════

export default function CompliancePage() {
    const t = useTranslations('Compliance');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [checks, setChecks] = useState<ComplianceCheck[]>([]);
    const [overallScore, setOverallScore] = useState(0);

    useEffect(() => {
        runComplianceCheck();
    }, []);

    const runComplianceCheck = async () => {
        setRefreshing(true);
        try {
            const res = await fetch("/api/reports?type=compliance");
            if (res.ok) {
                const data = await res.json();
                setChecks(data.checks || []);
                setOverallScore(data.score || 0);
            } else {
                console.error("Compliance API returned:", res.status);
                setChecks([]);
                setOverallScore(0);
            }
        } catch (error) {
            console.error("Compliance check failed:", error);
            setChecks([]);
            setOverallScore(0);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Build categories
    const categoryMap = new Map<string, ComplianceCategory>();
    const iconMap: Record<string, any> = {
        Wages: Banknote,
        Leave: Calendar,
        PF: Shield,
        Gratuity: Banknote,
        Notice: FileText,
        "Working Hours": Clock,
        Documentation: FileText,
    };

    checks.forEach(check => {
        const existing = categoryMap.get(check.category) || {
            name: check.category,
            icon: iconMap[check.category] || Shield,
            total: 0,
            passed: 0,
            failed: 0,
            score: 0,
        };
        existing.total++;
        if (check.status === "pass") existing.passed++;
        else existing.failed++;
        existing.score = Math.round((existing.passed / existing.total) * 100);
        categoryMap.set(check.category, existing);
    });

    const categories = Array.from(categoryMap.values());

    const failedChecks = checks.filter(c => c.status === "fail");
    const warningChecks = checks.filter(c => c.status === "warning");
    const passedChecks = checks.filter(c => c.status === "pass");

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                            <ShieldCheck className="h-7 w-7 text-emerald-400" />
                            {t('title')}
                        </h1>
                        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={runComplianceCheck}
                        disabled={refreshing}
                        className="gap-2"
                    >
                        {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        {t('recheck')}
                    </Button>
                </div>

                {/* Score + Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Overall Score */}
                    <Card>
                        <CardContent className="p-6 flex flex-col items-center justify-center">
                            {loading ? (
                                <Skeleton className="h-[180px] w-[180px] rounded-full" />
                            ) : (
                                <ScoreRing score={overallScore} label={t('complianceLabel')} sublabel={t('scoreLabel')} />
                            )}
                            <div className="flex gap-4 mt-4">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-emerald-400">{passedChecks.length}</p>
                                    <p className="text-xs text-muted-foreground">Passed</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-amber-400">{warningChecks.length}</p>
                                    <p className="text-xs text-muted-foreground">Warnings</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-red-400">{failedChecks.length}</p>
                                    <p className="text-xs text-muted-foreground">Failed</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Category Breakdown */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base">{t('categoryBreakdown')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {categories.map((cat) => {
                                        const CatIcon = cat.icon;
                                        return (
                                            <div key={cat.name} className="flex items-center gap-4 p-3 rounded-xl bg-hover">
                                                <div className="h-9 w-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                                                    <CatIcon className="h-4 w-4 text-blue-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                                                        <span className={`text-sm font-bold ${cat.score >= 80 ? "text-emerald-400"
                                                            : cat.score >= 60 ? "text-amber-400"
                                                                : "text-red-400"
                                                            }`}>{cat.score}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-hover rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${cat.score >= 80 ? "bg-emerald-400"
                                                                : cat.score >= 60 ? "bg-amber-400"
                                                                    : "bg-red-400"
                                                                }`}
                                                            style={{ width: `${cat.score}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {cat.passed}/{cat.total} {t('checksPassed')}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Violations / Issues */}
                {(failedChecks.length > 0 || warningChecks.length > 0) && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-400" />
                                {t('issuesRequiringAttention')}
                            </CardTitle>
                            <CardDescription>
                                {failedChecks.length} + {warningChecks.length} {t('violationsAndWarnings')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[...failedChecks, ...warningChecks].map((check) => {
                                    const sev = severityConfig[check.severity];
                                    const StatusIcon = statusIcons[check.status];
                                    return (
                                        <div
                                            key={check.id}
                                            className={`p-4 rounded-xl border ${sev.borderColor} bg-hover`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <StatusIcon className={`h-5 w-5 shrink-0 mt-0.5 ${statusColors[check.status]}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-sm font-medium text-foreground">{check.rule}</h4>
                                                        <Badge className={`${sev.color} text-[10px]`}>{sev.label}</Badge>
                                                        {check.affectedCount > 0 && (
                                                            <Badge variant="default" className="text-[10px]">
                                                                {check.affectedCount} {t('affected')}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">{check.description}</p>
                                                    {check.details && (
                                                        <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                                                            <Info className="h-3 w-3" /> {check.details}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Passed Checks */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            {t('passingChecks')} ({passedChecks.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {passedChecks.map((check) => (
                                    <div key={check.id} className="flex items-center gap-3 p-3 rounded-xl bg-hover">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-foreground truncate">{check.rule}</p>
                                            <p className="text-xs text-muted-foreground">{check.category}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
