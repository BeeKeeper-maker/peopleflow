"use client";

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
import { DollarSign } from "lucide-react";

interface RevenueTrend {
    month: string;
    mrr: number;
}

interface PlanDistribution {
    plan: string;
    count: number;
    percentage: number;
}

const PIE_COLORS = ["#6366F1", "#8B5CF6", "#A78BFA", "#C4B5FD", "#818CF8"];

interface PlatformDashboardChartsProps {
    revenueTrend: RevenueTrend[];
    planDistribution: PlanDistribution[];
    /** Render mode: 'revenue' renders the area chart, 'pie' renders the pie chart. */
    render: "revenue" | "pie";
}

/**
 * Charts component for Platform Dashboard.
 *
 * Extracted from the main dashboard page so that the heavy `recharts`
 * library is only loaded when the dashboard is actually rendered.
 * Imported via `next/dynamic` in the parent page so the recharts
 * bundle becomes a separate chunk.
 */
export function PlatformDashboardCharts({
    revenueTrend,
    planDistribution,
    render,
}: PlatformDashboardChartsProps) {
    if (render === "revenue") {
        if (revenueTrend.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[240px] text-zinc-600">
                    <DollarSign className="w-8 h-8 mb-2" />
                    <p className="text-sm">No revenue data yet</p>
                    <p className="text-xs mt-1">Revenue appears after first paid invoice</p>
                </div>
            );
        }
        return (
            <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueTrend}>
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
                        formatter={(v) => [`৳${Number(v).toLocaleString()}`, "Revenue"]}
                    />
                    <Area type="monotone" dataKey="mrr" stroke="#6366F1" strokeWidth={2} fill="url(#mrrGradient)" />
                </AreaChart>
            </ResponsiveContainer>
        );
    }

    // Pie chart
    return (
        <ResponsiveContainer width="100%" height={160}>
            <PieChart>
                <Pie
                    data={planDistribution}
                    dataKey="count"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    strokeWidth={0}
                >
                    {planDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{ backgroundColor: "#1C1C2A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#fff", fontSize: 13 }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}

export const PIE_COLORS_EXPORT = PIE_COLORS;
