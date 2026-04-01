"use client";

import { useEffect, useState } from "react";
import {
    DollarSign,
    TrendingUp,
    Building2,
    AlertTriangle,
    Users,
    Activity,
    ArrowUpRight,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { MetricCard } from "@/components/platform/metric-card";

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

// Revenue trend mock (in production: real historical data)
const REVENUE_TREND = [
    { month: "Oct", mrr: 0 },
    { month: "Nov", mrr: 8999 },
    { month: "Dec", mrr: 15998 },
    { month: "Jan", mrr: 29997 },
    { month: "Feb", mrr: 44995 },
    { month: "Mar", mrr: 62993 },
];

const PIE_COLORS = ["#6366F1", "#8B5CF6", "#A78BFA", "#C4B5FD"];

export default function PlatformDashboardPage() {
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
                        <div key={i} className="h-32 rounded-xl bg-white/[0.03]" />
                    ))}
                </div>
                <div className="h-80 rounded-xl bg-white/[0.03]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                    Dashboard
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                    Real-time platform overview and SaaS metrics
                </p>
            </div>

            {/* Metric Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Monthly Recurring Revenue"
                    value={analytics?.mrr || 0}
                    prefix="৳"
                    change={12.5}
                    icon={DollarSign}
                    color="indigo"
                    delay={0}
                />
                <MetricCard
                    title="Annual Run Rate"
                    value={analytics?.arr || 0}
                    prefix="৳"
                    change={12.5}
                    icon={TrendingUp}
                    color="violet"
                    delay={60}
                />
                <MetricCard
                    title="Active Tenants"
                    value={analytics?.activeTenants || 0}
                    suffix={`/ ${analytics?.totalTenants || 0}`}
                    change={8}
                    icon={Building2}
                    color="emerald"
                    delay={120}
                />
                <MetricCard
                    title="Churn Rate"
                    value={analytics?.churnRate?.toFixed(1) || "0.0"}
                    suffix="%"
                    change={-2.1}
                    changeLabel="lower is better"
                    icon={AlertTriangle}
                    color="amber"
                    delay={180}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold text-white">
                                Revenue Trend
                            </h3>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                Monthly Recurring Revenue (MRR)
                            </p>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                            <ArrowUpRight className="w-3 h-3" />
                            +39.8%
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={REVENUE_TREND}>
                            <defs>
                                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="month" tick={{ fill: "#71717A", fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#71717A", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1C1C2A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#fff", fontSize: 13 }}
                                formatter={(v) => [`৳${Number(v).toLocaleString()}`, "MRR"]}
                            />
                            <Area type="monotone" dataKey="mrr" stroke="#6366F1" strokeWidth={2} fill="url(#mrrGradient)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Plan Distribution */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <h3 className="text-sm font-semibold text-white mb-1">
                        Plan Distribution
                    </h3>
                    <p className="text-xs text-zinc-500 mb-4">Active subscriptions</p>
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie
                                data={analytics?.planDistribution || []}
                                dataKey="count"
                                nameKey="plan"
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={4}
                                strokeWidth={0}
                            >
                                {(analytics?.planDistribution || []).map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1C1C2A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#fff", fontSize: 13 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-2">
                        {(analytics?.planDistribution || []).map((plan, i) => (
                            <div key={plan.plan} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                                    <span className="text-zinc-400">{plan.plan}</span>
                                </div>
                                <span className="text-white font-medium tabular-nums">{plan.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Top Tenants + Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Tenants */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">Top Tenants</h3>
                        <a href="/platform/tenants" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                            View all →
                        </a>
                    </div>
                    <div className="space-y-3">
                        {(analytics?.topTenants || []).slice(0, 5).map((tenant, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">
                                        {tenant.name?.charAt(0) || "T"}
                                    </div>
                                    <div>
                                        <p className="text-sm text-white font-medium">{tenant.name}</p>
                                        <p className="text-xs text-zinc-600">
                                            {tenant.employees} employees • {tenant.plan}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-sm text-white font-semibold tabular-nums">
                                    ৳{tenant.mrr?.toLocaleString()}
                                </span>
                            </div>
                        ))}
                        {(!analytics?.topTenants || analytics.topTenants.length === 0) && (
                            <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
                                <Users className="w-8 h-8 mb-2" />
                                <p className="text-sm">No tenants yet</p>
                                <p className="text-xs mt-1">Provision your first tenant to see data</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                        <a href="/platform/audit-logs" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                            View all →
                        </a>
                    </div>
                    <div className="space-y-1">
                        {activities.slice(0, 6).map((activity) => (
                            <div
                                key={activity.id}
                                className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-zinc-300 truncate">
                                        <span className="text-white font-medium">
                                            {activity.platformAdmin?.name || "System"}
                                        </span>{" "}
                                        {activity.action.replace(/\./g, " → ")}
                                    </p>
                                    <p className="text-xs text-zinc-600 mt-0.5">
                                        {new Date(activity.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {activities.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
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
