"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import {
    Target,
    TrendingUp,
    CheckCircle2,
    Clock,
    Loader2,
    BarChart3,
    Calendar,
    Flag,
    AlertTriangle,
} from "lucide-react";

interface KeyResult {
    id: string;
    title: string;
    targetValue: number;
    currentValue: number;
    unit?: string;
    status: string;
}

interface Goal {
    id: string;
    title: string;
    description?: string;
    type: string;
    priority: string;
    status: string;
    progress: number;
    startDate?: string;
    dueDate?: string;
    completedAt?: string;
    keyResults: KeyResult[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    not_started: { label: "notStarted", color: "bg-gray-500/15 text-gray-400 border-gray-500/20", icon: Clock },
    in_progress: { label: "inProgress", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: TrendingUp },
    completed: { label: "completed", color: "bg-green-500/15 text-green-400 border-green-500/20", icon: CheckCircle2 },
    on_track: { label: "onTrack", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: TrendingUp },
    at_risk: { label: "atRisk", color: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: AlertTriangle },
    behind: { label: "behind", color: "bg-red-500/15 text-red-400 border-red-500/20", icon: AlertTriangle },
};

const priorityConfig: Record<string, { color: string }> = {
    low: { color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
    medium: { color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
    high: { color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
    critical: { color: "bg-red-500/15 text-red-400 border-red-500/20" },
};

export default function ESSPerformancePage() {
    const { addToast } = useToast();
    const t = useTranslations("ESSPerformance");
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGoals = async () => {
            try {
                // FIX #1: Correct API endpoint with my=true to scope to current employee
                const res = await fetch("/api/performance/goals?my=true");
                if (res.ok) {
                    const data = await res.json();
                    // FIX #9: Handle successResponse() wrapper format { success, data }
                    const goalsData = data?.data || (Array.isArray(data) ? data : (data.goals || []));
                    setGoals(goalsData);
                }
            } catch (err) {
                console.error("Failed to fetch goals:", err);
                addToast({ title: "Failed to load data. Please refresh the page.", type: "error" });
            } finally {
                setLoading(false);
            }
        };

        fetchGoals();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.status === "completed").length;
    const inProgressGoals = goals.filter(g => g.status === "in_progress").length;
    const overallProgress = totalGoals > 0
        ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / totalGoals)
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
                <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="p-4 text-center">
                        <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                            <BarChart3 className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{overallProgress}%</p>
                        <p className="text-xs text-muted-foreground">{t("overallProgress")}</p>
                    </CardContent>
                </Card>
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="p-4 text-center">
                        <div className="mx-auto w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2">
                            <Target className="h-6 w-6 text-blue-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{totalGoals}</p>
                        <p className="text-xs text-muted-foreground">{t("totalGoals")}</p>
                    </CardContent>
                </Card>
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="p-4 text-center">
                        <div className="mx-auto w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-2">
                            <CheckCircle2 className="h-6 w-6 text-green-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{completedGoals}</p>
                        <p className="text-xs text-muted-foreground">{t("completed")}</p>
                    </CardContent>
                </Card>
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="p-4 text-center">
                        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
                            <TrendingUp className="h-6 w-6 text-amber-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{inProgressGoals}</p>
                        <p className="text-xs text-muted-foreground">{t("inProgress")}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Goals list */}
            {goals.length === 0 ? (
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="py-16 text-center">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                            <Target className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">{t("noGoals")}</h3>
                        <p className="text-muted-foreground text-sm">{t("noGoalsDesc")}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {goals.map((goal) => {
                        const config = statusConfig[goal.status] || statusConfig.not_started;
                        const StatusIcon = config.icon;
                        const prioConfig = priorityConfig[goal.priority] || priorityConfig.medium;

                        return (
                            <Card key={goal.id} className="bg-card-bg border-card-border hover:border-primary/20 transition-colors">
                                <CardContent className="p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                                                <Target className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-foreground">{goal.title}</h3>
                                                {goal.description && (
                                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{goal.description}</p>
                                                )}
                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border",
                                                        config.color
                                                    )}>
                                                        <StatusIcon className="h-3 w-3" />
                                                        {t(config.label as any)}
                                                    </span>
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border",
                                                        prioConfig.color
                                                    )}>
                                                        <Flag className="h-3 w-3" />
                                                        {t(goal.priority as any)}
                                                    </span>
                                                    {goal.dueDate && (
                                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Calendar className="h-3 w-3" />
                                                            {t("dueDate")}: {new Date(goal.dueDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress circle */}
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-14 h-14">
                                                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                                                    <path
                                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        className="text-muted/30"
                                                    />
                                                    <path
                                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                        fill="none"
                                                        strokeWidth="2.5"
                                                        strokeDasharray={`${goal.progress || 0}, 100`}
                                                        strokeLinecap="round"
                                                        className={cn(
                                                            "transition-all duration-500",
                                                            (goal.progress || 0) >= 80 ? "stroke-green-500" :
                                                                (goal.progress || 0) >= 50 ? "stroke-blue-500" :
                                                                    (goal.progress || 0) >= 25 ? "stroke-amber-500" : "stroke-red-500"
                                                        )}
                                                    />
                                                </svg>
                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                                                    {goal.progress || 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Key Results */}
                                    {goal.keyResults && goal.keyResults.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-card-border">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">{t("keyResults")}</p>
                                            <div className="space-y-2">
                                                {goal.keyResults.map(kr => {
                                                    const krProgress = kr.targetValue > 0
                                                        ? Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100))
                                                        : 0;
                                                    return (
                                                        <div key={kr.id} className="flex items-center gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span className="text-muted-foreground truncate">{kr.title}</span>
                                                                    <span className="text-foreground font-medium shrink-0">
                                                                        {kr.currentValue}/{kr.targetValue} {kr.unit || ""}
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                                                    <div
                                                                        className={cn(
                                                                            "h-full rounded-full transition-all duration-500",
                                                                            krProgress >= 80 ? "bg-green-500" :
                                                                                krProgress >= 50 ? "bg-blue-500" :
                                                                                    krProgress >= 25 ? "bg-amber-500" : "bg-red-500"
                                                                        )}
                                                                        style={{ width: `${krProgress}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
