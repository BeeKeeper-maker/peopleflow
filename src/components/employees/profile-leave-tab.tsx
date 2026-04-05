"use client"

import { CalendarDays, Clock, TrendingUp, CheckCircle, XCircle, Hourglass } from "lucide-react"
import { format } from "date-fns"

interface LeaveBalance {
    type: string
    color: string
    allocated: number
    used: number
    carried: number
    remaining: number
}

interface LeaveHistoryItem {
    id: string
    type: string
    from: string
    to: string
    days: number
    status: string
    reason: string | null
    halfDay: boolean
}

interface LeaveData {
    balances: LeaveBalance[]
    history: LeaveHistoryItem[]
    totalUsed: number
    totalRemaining: number
}

interface LeaveTabProps {
    data: LeaveData | null
    loading: boolean
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    approved: { icon: <CheckCircle className="h-3.5 w-3.5" />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    pending: { icon: <Hourglass className="h-3.5 w-3.5" />, color: "text-amber-400", bg: "bg-amber-500/10" },
    rejected: { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-400", bg: "bg-red-500/10" },
    cancelled: { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-gray-400", bg: "bg-gray-500/10" },
}

/** Circular progress ring */
function ProgressRing({ percentage, color, size = 80, strokeWidth = 6 }: { percentage: number; color: string; size?: number; strokeWidth?: number }) {
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (Math.min(percentage, 100) / 100) * circumference

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none" />
            <circle
                cx={size / 2} cy={size / 2} r={radius}
                stroke={color} strokeWidth={strokeWidth} fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-1000 ease-out"
            />
        </svg>
    )
}

export function LeaveTab({ data, loading }: LeaveTabProps) {
    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-36 rounded-xl bg-hover border border-card-border" />
                    ))}
                </div>
                <div className="h-64 rounded-xl bg-hover border border-card-border" />
            </div>
        )
    }

    if (!data || data.balances.length === 0) {
        return (
            <div className="p-12 text-center text-muted-foreground border border-dashed border-card-border rounded-xl">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground">No Leave Allocations</h3>
                <p className="text-sm">Leave balances have not been configured for this employee.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ── Summary Bar ─────────────────────────────────────────── */}
            <div className="flex items-center gap-6 rounded-xl border border-card-border bg-hover p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Total Used</p>
                        <p className="text-lg font-bold text-foreground">{data.totalUsed} <span className="text-sm font-normal text-muted-foreground">days</span></p>
                    </div>
                </div>
                <div className="h-8 w-px bg-card-border" />
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Total Remaining</p>
                        <p className="text-lg font-bold text-emerald-400">{data.totalRemaining} <span className="text-sm font-normal text-muted-foreground">days</span></p>
                    </div>
                </div>
            </div>

            {/* ── Leave Balance Cards with Rings ──────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {data.balances.map((balance, i) => {
                    const total = balance.allocated + balance.carried
                    const usedPercent = total > 0 ? (balance.used / total) * 100 : 0

                    return (
                        <div key={i} className="rounded-xl border border-card-border bg-hover p-5 backdrop-blur-sm hover:border-opacity-60 transition-all duration-300 group hover:scale-[1.02]">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: balance.color }} />
                                        <h4 className="text-sm font-semibold text-foreground">{balance.type}</h4>
                                    </div>
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Allocated</span>
                                            <span className="font-medium text-foreground">{balance.allocated}d</span>
                                        </div>
                                        {balance.carried > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Carried</span>
                                                <span className="font-medium text-blue-400">+{balance.carried}d</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Used</span>
                                            <span className="font-medium text-foreground">{balance.used}d</span>
                                        </div>
                                        <div className="h-px bg-card-border my-1" />
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground font-medium">Remaining</span>
                                            <span className="font-bold" style={{ color: balance.color }}>{balance.remaining}d</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative flex items-center justify-center ml-3">
                                    <ProgressRing percentage={usedPercent} color={balance.color} size={64} strokeWidth={5} />
                                    <span className="absolute text-xs font-bold text-foreground">{Math.round(usedPercent)}%</span>
                                </div>
                            </div>
                            {/* Usage bar */}
                            <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${Math.min(usedPercent, 100)}%`, background: balance.color }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── Leave History Timeline ──────────────────────────────── */}
            <div className="rounded-xl border border-card-border bg-hover backdrop-blur-sm">
                <div className="p-6 pb-4">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-blue-400" />
                        <h3 className="font-semibold text-foreground">Leave History</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Recent leave applications and their status</p>
                </div>
                <div className="px-6 pb-6 space-y-3">
                    {data.history.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">No leave records found</div>
                    ) : (
                        data.history.map((leave) => {
                            const config = statusConfig[leave.status] || statusConfig.pending
                            return (
                                <div key={leave.id} className="flex items-center gap-4 p-3 rounded-lg border border-card-border/50 hover:bg-card-bg/30 transition-colors">
                                    <div className={`h-9 w-9 rounded-lg ${config.bg} flex items-center justify-center shrink-0 ${config.color}`}>
                                        {config.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-foreground">{leave.type}</span>
                                            {leave.halfDay && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">Half Day</span>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {format(new Date(leave.from), "MMM d")} — {format(new Date(leave.to), "MMM d, yyyy")}
                                            {leave.reason && <span className="ml-2">· {leave.reason}</span>}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={`text-sm font-semibold ${config.color} capitalize`}>{leave.status}</span>
                                        <p className="text-xs text-muted-foreground">{leave.days}d</p>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
