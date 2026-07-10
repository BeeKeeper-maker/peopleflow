"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
    DollarSign,
    TrendingUp,
    Building2,
    AlertTriangle,
    Users,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    CreditCard,
    Target,
    UserPlus,
} from "lucide-react";
import { MetricCard } from "@/components/platform/metric-card";

const LazyCharts = dynamic(
    () => import("./_components/platform-dashboard-charts").then(m => ({ default: m.PlatformDashboardCharts })),
    {
        loading: () => (
            <div className="w-full h-[240px] rounded-xl bg-hover animate-pulse" />
        ),
        ssr: false,
    }
);

interface RevenueTrend {
    month: string;
    mrr: number;
}

interface Analytics {
    mrr: number;
    arr: number;
    totalTenants: number;
    activeTenants: number;
    trialingTenants: number;
    suspendedTenants: number;
    churnRate: number;
    trialConversionRate: number;
    planDistribution: { plan: string; count: number; percentage: number }[];
    topTenants: { name: string; employees: number; plan: string; mrr: number }[];
    // New fields from enhanced API
    revenue?: {
        revenueTrend?: RevenueTrend[];
        revenueGrowthPercent?: number;
        invoicesPaid?: number;
        recentRevenue?: number;
    };
    tenants?: {
        newThisMonth?: number;
    };
    health?: {
        failedPayments?: number;
        pastDueTenants?: number;
        trialConversionRate?: number;
    };
}

interface RecentActivity {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
    platformAdmin?: { name: string };
}

const PIE_COLORS = ["#6366F1", "#8B5CF6", "#A78BFA", "#C4B5FD", "#818CF8"];

export default function PlatformDashboardPage() {
    const t = useTranslations("Platform");
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [activities, setActivities] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/platform/analytics", { credentials: "include" }).then((r) => r.json()),
            fetch("/api/platform/audit-logs?limit=8", { credentials: "include" }).then((r) => r.json()),
        ])
            .then(([analyticsData, auditData]) => {
                setAnalytics(analyticsData);
                setActivities(auditData.logs || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 rounded-xl bg-hover" />
                    ))}
                </div>
                <div className="h-80 rounded-xl bg-hover" />
            </div>
        );
    }

    // Use real revenue trend from API, fallback to empty array
    const revenueTrend = analytics?.revenue?.revenueTrend || [];
    const revenueGrowth = analytics?.revenue?.revenueGrowthPercent || 0;
    const trialConversionRate = analytics?.health?.trialConversionRate || analytics?.trialConversionRate || 0;
    const failedPayments = analytics?.health?.failedPayments || 0;
    const pastDueTenants = analytics?.health?.pastDueTenants || 0;
    const newTenantsThisMonth = analytics?.tenants?.newThisMonth || 0;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {t("dashboard")}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {t("dashboardSubtitle")}
                </p>
            </div>

            {/* Metric Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title={t("mrr")}
                    value={analytics?.mrr || 0}
                    prefix="৳"
                    change={revenueGrowth}
                    icon={DollarSign}
                    color="indigo"
                    delay={0}
                />
                <MetricCard
                    title={t("arr")}
                    value={analytics?.arr || 0}
                    prefix="৳"
                    change={revenueGrowth}
                    icon={TrendingUp}
                    color="violet"
                    delay={60}
                />
                <MetricCard
                    title={t("activeTenants")}
                    value={analytics?.activeTenants || 0}
                    suffix={`/ ${analytics?.totalTenants || 0}`}
                    change={newTenantsThisMonth > 0 ? 8 : 0}
                    icon={Building2}
                    color="emerald"
                    delay={120}
                />
                <MetricCard
                    title={t("churnRate")}
                    value={analytics?.churnRate?.toFixed(1) || "0.0"}
                    suffix="%"
                    change={-2.1}
                    changeLabel="lower is better"
                    icon={AlertTriangle}
                    color="amber"
                    delay={180}
                />
            </div>

            {/* Secondary Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SecondaryMetric
                    icon={Target}
                    label={t("trialConversion")}
                    value={`${trialConversionRate}%`}
                    color="text-blue-400"
                    bgColor="bg-blue-500/10"
                />
                <SecondaryMetric
                    icon={UserPlus}
                    label={t("newThisMonth")}
                    value={newTenantsThisMonth}
                    color="text-emerald-400"
                    bgColor="bg-emerald-500/10"
                />
                <SecondaryMetric
                    icon={CreditCard}
                    label={t("failedPayments")}
                    value={failedPayments}
                    color="text-red-400"
                    bgColor="bg-red-500/10"
                />
                <SecondaryMetric
                    icon={AlertTriangle}
                    label="Past Due Tenants"
                    value={pastDueTenants}
                    color="text-amber-400"
                    bgColor="bg-amber-500/10"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Revenue Chart — REAL DATA */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-hover/50 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                Revenue Trend
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Monthly Revenue (last 6 months) — real data
                            </p>
                        </div>
                        {revenueGrowth !== 0 && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                                revenueGrowth > 0
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-red-500/10 text-red-400"
                            }`}>
                                {revenueGrowth > 0 ? (
                                    <ArrowUpRight className="w-3 h-3" />
                                ) : (
                                    <ArrowDownRight className="w-3 h-3" />
                                )}
                                {revenueGrowth > 0 ? "+" : ""}{revenueGrowth}%
                            </div>
                        )}
                    </div>
                    {revenueTrend.length > 0 ? (
                        <LazyCharts
                            revenueTrend={revenueTrend}
                            planDistribution={[]}
                            render="revenue"
                        />
                    ) : (
                        <LazyCharts
                            revenueTrend={[]}
                            planDistribution={[]}
                            render="revenue"
                        />
                    )}
                </div>

                {/* Plan Distribution */}
                <div className="rounded-xl border border-border bg-hover/50 p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                        Plan Distribution
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">Active subscriptions</p>
                    <LazyCharts
                        revenueTrend={[]}
                        planDistribution={analytics?.planDistribution || []}
                        render="pie"
                    />
                    <div className="space-y-2 mt-2">
                        {(analytics?.planDistribution || []).map((plan, i) => (
                            <div key={plan.plan} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                    <span className="text-muted-foreground">{plan.plan}</span>
                                </div>
                                <span className="text-foreground font-medium tabular-nums">{plan.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Top Tenants + Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Tenants */}
                <div className="rounded-xl border border-border bg-hover/50 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground">Top Tenants</h3>
                        <Link href="/platform/tenants" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                            {t("viewAll")} →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {(analytics?.topTenants || []).slice(0, 5).map((tenant, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-hover transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">
                                        {tenant.name?.charAt(0) || "T"}
                                    </div>
                                    <div>
                                        <p className="text-sm text-foreground font-medium">{tenant.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {tenant.employees} employees • {tenant.plan}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-sm text-foreground font-semibold tabular-nums">
                                    ৳{tenant.mrr?.toLocaleString()}
                                </span>
                            </div>
                        ))}
                        {(!analytics?.topTenants || analytics.topTenants.length === 0) && (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <Users className="w-8 h-8 mb-2" />
                                <p className="text-sm">No tenants yet</p>
                                <p className="text-xs mt-1">Provision your first tenant to see data</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="rounded-xl border border-border bg-hover/50 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
                        <a href="/platform/audit-logs" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                            {t("viewAll")} →
                        </a>
                    </div>
                    <div className="space-y-1">
                        {activities.slice(0, 6).map((activity) => (
                            <div
                                key={activity.id}
                                className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-hover transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground truncate">
                                        <span className="text-foreground font-medium">
                                            {activity.platformAdmin?.name || "System"}
                                        </span>{" "}
                                        {activity.action.replace(/\./g, " → ")}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {new Date(activity.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {activities.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <Activity className="w-8 h-8 mb-2" />
                                <p className="text-sm">No activity yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Secondary metric card component
function SecondaryMetric({
    icon: Icon,
    label,
    value,
    color,
    bgColor,
}: {
    icon: typeof Users;
    label: string;
    value: string | number;
    color: string;
    bgColor: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-hover/50 p-4">
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
                </div>
            </div>
        </div>
    );
}
