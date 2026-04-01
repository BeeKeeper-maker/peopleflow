"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, LeaveRequest } from "@/components/leaves/requests/columns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
    CalendarOff,
    Clock,
    CheckCircle2,
    XCircle,
    RefreshCw,
    TrendingUp,
    CalendarDays,
    Users,
    Filter,
} from "lucide-react"
import { useTranslations } from "next-intl"

// ════════════════════════════════════════════════════════════════════════
// Animated Counter
// ════════════════════════════════════════════════════════════════════════

function AnimatedCounter({ target, duration = 1000 }: { target: number; duration?: number }) {
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (target === 0) { setCount(0); return }
        let start = 0
        const step = Math.max(1, Math.ceil(target / (duration / 16)))
        const timer = setInterval(() => {
            start += step
            if (start >= target) { setCount(target); clearInterval(timer) }
            else setCount(start)
        }, 16)
        return () => clearInterval(timer)
    }, [target, duration])

    return <>{count}</>
}

// ════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════

export default function LeaveRequestsPage() {
    const [allData, setAllData] = useState<LeaveRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeFilter, setActiveFilter] = useState<string>("pending")
    const t = useTranslations('Leaves')

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Fetch all requests for comprehensive stats
            const response = await fetch("/api/leaves/applications")
            if (response.ok) {
                const result = await response.json()
                setAllData(Array.isArray(result) ? result : result.data || [])
            }
        } catch (error) {
            console.error("Failed to fetch leave requests", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // ── Computed Stats ─────────────────────────────────────────────
    const stats = useMemo(() => {
        const pending = allData.filter(r => r.status === "pending").length
        const approved = allData.filter(r => r.status === "approved").length
        const rejected = allData.filter(r => r.status === "rejected").length

        // Today's on-leave count
        const today = new Date().toISOString().split("T")[0]
        const onLeaveToday = allData.filter(r => {
            if (r.status !== "approved") return false
            const from = (r as any).fromDate?.split("T")[0] || ""
            const to = (r as any).toDate?.split("T")[0] || ""
            return from <= today && to >= today
        }).length

        // Total days requested this month
        const totalDays = allData
            .filter(r => r.status === "approved")
            .reduce((sum, r) => sum + ((r as any).totalDays || 0), 0)

        return { pending, approved, rejected, onLeaveToday, totalDays, total: allData.length }
    }, [allData])

    // ── Filtered Data ──────────────────────────────────────────────
    const filteredData = useMemo(() => {
        if (activeFilter === "all") return allData
        return allData.filter(r => r.status === activeFilter)
    }, [allData, activeFilter])

    const statCards = [
        {
            key: "pending",
            label: t('pendingApproval') || "Pending",
            value: stats.pending,
            Icon: Clock,
            color: "from-amber-500 to-amber-600",
            glowColor: "bg-amber-500",
            badge: stats.pending > 0 ? "Action Required" : undefined,
            badgeClass: "bg-amber-500/20 text-amber-400",
        },
        {
            key: "approved",
            label: t('approved') || "Approved",
            value: stats.approved,
            Icon: CheckCircle2,
            color: "from-emerald-500 to-emerald-600",
            glowColor: "bg-emerald-500",
        },
        {
            key: "rejected",
            label: t('rejected') || "Rejected",
            value: stats.rejected,
            Icon: XCircle,
            color: "from-red-500 to-red-600",
            glowColor: "bg-red-500",
        },
        {
            key: "onLeaveToday",
            label: t('onLeaveToday') || "On Leave Today",
            value: stats.onLeaveToday,
            Icon: CalendarDays,
            color: "from-purple-500 to-purple-600",
            glowColor: "bg-purple-500",
        },
    ]

    return (
        <div className="space-y-6">
            {/* ── Hero Header ──────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/25">
                        <CalendarOff className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('requestsTitle')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('requestsSubtitle')}
                            {!isLoading && (
                                <Badge variant="default" className="ml-2">
                                    {stats.total} total
                                </Badge>
                            )}
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchData}
                    disabled={isLoading}
                    className="gap-2 border-card-border hover:border-border"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{t('refresh') || "Refresh"}</span>
                </Button>
            </div>

            {/* ── Stats Row ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-20" />
                                        <Skeleton className="h-8 w-12" />
                                    </div>
                                    <Skeleton className="h-11 w-11 rounded-xl" />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    statCards.map((card) => (
                        <Card
                            key={card.key}
                            className={`relative overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-0.5 ${
                                activeFilter === card.key ? "border-border ring-1 ring-blue-500/30" : ""
                            }`}
                            onClick={() => setActiveFilter(prev => prev === card.key ? "all" : card.key)}
                        >
                            {/* Glow */}
                            <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full ${card.glowColor} opacity-20 blur-3xl group-hover:opacity-40 transition-opacity duration-500`} />
                            <CardContent className="p-5 relative">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                                        <p className="text-3xl font-bold text-foreground tabular-nums">
                                            <AnimatedCounter target={card.value} />
                                        </p>
                                        {card.badge && (
                                            <Badge className={`${card.badgeClass} text-[10px] mt-1`}>
                                                {card.badge}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br ${card.color} shadow-lg`}>
                                        <card.Icon className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* ── Active Filter Indicator ──────────────────────────── */}
            {activeFilter !== "all" && !isLoading && (
                <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                        Showing <span className="font-medium text-foreground">{activeFilter}</span> requests
                    </span>
                    <button
                        onClick={() => setActiveFilter("all")}
                        className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                    >
                        Show all
                    </button>
                </div>
            )}

            {/* ── DataTable ────────────────────────────────────────── */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-8">
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={filteredData}
                    searchKey="employeeName"
                    placeholder={t('requestsSearchPlaceholder')}
                    emptyTitle={activeFilter === "pending" ? (t('noPendingRequests') || "No pending requests") : (t('noRequests') || "No requests found")}
                    emptyDescription={activeFilter === "pending"
                        ? (t('noPendingDesc') || "All leave requests have been processed. Great job!")
                        : (t('noRequestsDesc') || "No leave requests match your current filter.")}
                    emptyVariant="calendar"
                />
            )}
        </div>
    )
}
