"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { Clock, TrendingUp, AlertTriangle, CheckCircle2, Zap, Timer, Wifi, Smartphone, Monitor, Fingerprint } from "lucide-react"
import { format } from "date-fns"

interface AttendanceData {
    rate: number
    punctualityRate: number
    present: number
    absent: number
    late: number
    onTime: number
    totalTracked: number
    avgLateMinutes: number
    weeklyData: { week: string; present: number; absent: number; late: number; leave: number }[]
    punchTimeline: {
        date: string
        checkIn: string | null
        checkOut: string | null
        status: string
        lateMinutes: number
        earlyLeaveMinutes: number
        overtimeMinutes: number
        source: string
    }[]
}

interface AttendanceTabProps {
    data: AttendanceData | null
    loading: boolean
}

// Custom tooltip for the chart
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload) return null
    return (
        <div className="rounded-lg border border-card-border bg-card-bg/95 backdrop-blur-sm p-3 shadow-xl">
            <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
            {payload.map((entry: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                    <span className="text-muted-foreground capitalize">{entry.name}:</span>
                    <span className="font-semibold text-foreground">{entry.value}</span>
                </div>
            ))}
        </div>
    )
}

const sourceIcons: Record<string, React.ReactNode> = {
    biometric: <Fingerprint className="h-3.5 w-3.5" />,
    mobile: <Smartphone className="h-3.5 w-3.5" />,
    web: <Monitor className="h-3.5 w-3.5" />,
    manual: <Wifi className="h-3.5 w-3.5" />,
}

const statusColors: Record<string, string> = {
    present: "bg-emerald-500",
    absent: "bg-red-500",
    half_day: "bg-amber-500",
    on_leave: "bg-blue-500",
    holiday: "bg-purple-500",
    weekend: "bg-gray-500",
}

export function AttendanceTab({ data, loading }: AttendanceTabProps) {
    const formattedTimeline = useMemo(() => {
        if (!data?.punchTimeline) return []
        return data.punchTimeline.map((p) => ({
            ...p,
            dateFormatted: format(new Date(p.date), "EEE, MMM d"),
            checkInFormatted: p.checkIn ? format(new Date(p.checkIn), "hh:mm a") : "—",
            checkOutFormatted: p.checkOut ? format(new Date(p.checkOut), "hh:mm a") : "—",
            duration: p.checkIn && p.checkOut
                ? `${Math.round((new Date(p.checkOut).getTime() - new Date(p.checkIn).getTime()) / 3600000)}h ${Math.round(((new Date(p.checkOut).getTime() - new Date(p.checkIn).getTime()) % 3600000) / 60000)}m`
                : "—",
        }))
    }, [data])

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-xl bg-hover border border-card-border" />
                ))}
                <div className="col-span-full h-72 rounded-xl bg-hover border border-card-border" />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="p-12 text-center text-muted-foreground border border-dashed border-card-border rounded-xl">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No attendance data available</p>
            </div>
        )
    }

    const metrics = [
        {
            label: "Attendance Rate",
            value: `${data.rate}%`,
            icon: CheckCircle2,
            color: data.rate >= 95 ? "text-emerald-400" : data.rate >= 80 ? "text-amber-400" : "text-red-400",
            bg: data.rate >= 95 ? "bg-emerald-500/10" : data.rate >= 80 ? "bg-amber-500/10" : "bg-red-500/10",
            border: data.rate >= 95 ? "border-emerald-500/20" : data.rate >= 80 ? "border-amber-500/20" : "border-red-500/20",
            sub: `${data.present} of ${data.totalTracked} days`,
        },
        {
            label: "Punctuality",
            value: `${data.punctualityRate}%`,
            icon: TrendingUp,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            sub: `${data.onTime} on-time days`,
        },
        {
            label: "Late Arrivals",
            value: `${data.late}`,
            icon: AlertTriangle,
            color: data.late > 5 ? "text-red-400" : "text-amber-400",
            bg: data.late > 5 ? "bg-red-500/10" : "bg-amber-500/10",
            border: data.late > 5 ? "border-red-500/20" : "border-amber-500/20",
            sub: data.avgLateMinutes > 0 ? `~${data.avgLateMinutes}min avg` : "Perfect record",
        },
        {
            label: "Absences",
            value: `${data.absent}`,
            icon: Zap,
            color: data.absent > 3 ? "text-red-400" : "text-emerald-400",
            bg: data.absent > 3 ? "bg-red-500/10" : "bg-emerald-500/10",
            border: data.absent > 3 ? "border-red-500/20" : "border-emerald-500/20",
            sub: "Last 30 days",
        },
    ]

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ── KPI Cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {metrics.map((m, i) => (
                    <div key={i} className={`rounded-xl border ${m.border} ${m.bg} p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                            <m.icon className={`h-4 w-4 ${m.color}`} />
                        </div>
                        <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Weekly Trend Chart ─────────────────────────────────────── */}
            <div className="rounded-xl border border-card-border bg-hover p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="font-semibold text-foreground">Weekly Attendance Trend</h3>
                        <p className="text-xs text-muted-foreground">Last 12 weeks breakdown</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Present</span>
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Absent</span>
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Late</span>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.weeklyData} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="week" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ── Punch Timeline ──────────────────────────────────────────── */}
            <div className="rounded-xl border border-card-border bg-hover backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-4">
                    <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-blue-400" />
                        <h3 className="font-semibold text-foreground">Punch Timeline</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Last 14 days check-in/out records</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-y border-card-border bg-card-bg/50">
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Check In</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Check Out</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-card-border">
                            {formattedTimeline.map((p, i) => (
                                <tr key={i} className="hover:bg-card-bg/30 transition-colors">
                                    <td className="px-6 py-3 font-medium text-foreground whitespace-nowrap">{p.dateFormatted}</td>
                                    <td className="px-6 py-3">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className={`h-2 w-2 rounded-full ${statusColors[p.status] || "bg-gray-400"}`} />
                                            <span className="capitalize text-foreground">{p.status.replace("_", " ")}</span>
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-foreground font-mono text-xs">
                                        {p.checkInFormatted}
                                        {p.lateMinutes > 0 && (
                                            <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">+{p.lateMinutes}m</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-foreground font-mono text-xs">
                                        {p.checkOutFormatted}
                                        {p.earlyLeaveMinutes > 0 && (
                                            <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">-{p.earlyLeaveMinutes}m</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-muted-foreground">{p.duration}</td>
                                    <td className="px-6 py-3">
                                        <span className="inline-flex items-center gap-1.5 text-muted-foreground capitalize">
                                            {sourceIcons[p.source] || null}
                                            <span className="text-xs">{p.source}</span>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {formattedTimeline.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No punch records found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
