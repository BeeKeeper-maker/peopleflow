"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    ScrollText,
    Search,
    Download,
    Clock,
    Filter,
    User,
    Shield,
    ShieldAlert,
    Activity,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Eye,
    AlertTriangle,
    UserCheck,
    Fingerprint,
    Globe,
    Monitor,
    Zap,
    Plus,
    Pencil,
    Trash2,
    LogIn,
    CheckCircle2,
    XCircle,
    FileText,
    ArrowRight,
    CalendarRange,
    BarChart3,
    X,
} from "lucide-react"

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

interface AuditLogEntry {
    id: string
    action: string
    entityType: string
    entityId: string
    oldValues: string | null
    newValues: string | null
    ipAddress: string | null
    userAgent: string | null
    performedBy: { name: string | null; email: string } | null
    createdAt: string
}

interface AuditStats {
    total: number
    todayCount: number
    criticalCount: number
    activeUsers: number
}

interface AuditFilters {
    actions: string[]
    entityTypes: string[]
}

// ═══════════════════════════════════════════════════════════════════════
// Action Config
// ═══════════════════════════════════════════════════════════════════════

const actionConfig: Record<string, {
    icon: typeof Plus
    label: string
    gradient: string
    bgClass: string
    textClass: string
    dotColor: string
}> = {
    create: {
        icon: Plus,
        label: "Create",
        gradient: "from-emerald-500/20 to-emerald-500/5",
        bgClass: "bg-emerald-500/15",
        textClass: "text-emerald-400",
        dotColor: "bg-emerald-500",
    },
    update: {
        icon: Pencil,
        label: "Update",
        gradient: "from-blue-500/20 to-blue-500/5",
        bgClass: "bg-blue-500/15",
        textClass: "text-blue-400",
        dotColor: "bg-blue-500",
    },
    delete: {
        icon: Trash2,
        label: "Delete",
        gradient: "from-red-500/20 to-red-500/5",
        bgClass: "bg-red-500/15",
        textClass: "text-red-400",
        dotColor: "bg-red-500",
    },
    login: {
        icon: LogIn,
        label: "Login",
        gradient: "from-violet-500/20 to-violet-500/5",
        bgClass: "bg-violet-500/15",
        textClass: "text-violet-400",
        dotColor: "bg-violet-500",
    },
    approve: {
        icon: CheckCircle2,
        label: "Approve",
        gradient: "from-green-500/20 to-green-500/5",
        bgClass: "bg-green-500/15",
        textClass: "text-green-400",
        dotColor: "bg-green-500",
    },
    reject: {
        icon: XCircle,
        label: "Reject",
        gradient: "from-orange-500/20 to-orange-500/5",
        bgClass: "bg-orange-500/15",
        textClass: "text-orange-400",
        dotColor: "bg-orange-500",
    },
    export: {
        icon: Download,
        label: "Export",
        gradient: "from-cyan-500/20 to-cyan-500/5",
        bgClass: "bg-cyan-500/15",
        textClass: "text-cyan-400",
        dotColor: "bg-cyan-500",
    },
    view: {
        icon: Eye,
        label: "View",
        gradient: "from-zinc-500/20 to-zinc-500/5",
        bgClass: "bg-zinc-500/15",
        textClass: "text-zinc-400",
        dotColor: "bg-zinc-500",
    },
}

const defaultActionConfig = {
    icon: Activity,
    label: "Action",
    gradient: "from-zinc-500/20 to-zinc-500/5",
    bgClass: "bg-zinc-500/15",
    textClass: "text-zinc-400",
    dotColor: "bg-zinc-500",
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function getRelativeTime(dateStr: string, tFn?: (key: string) => string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    const t = tFn || ((k: string) => k)
    if (diffSec < 60) return t("justNow")
    if (diffMin < 60) return `${diffMin} ${t('mAgo')}`
    if (diffHr < 24) return `${diffHr} ${t('hAgo')}`
    if (diffDay < 7) return `${diffDay} ${t('dAgo')}`
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function parseDeviceInfo(userAgent: string | null): { browser: string; os: string } {
    if (!userAgent) return { browser: "Unknown", os: "Unknown" }
    let browser = "Unknown"
    let os = "Unknown"

    if (userAgent.includes("Chrome") && !userAgent.includes("Edge")) browser = "Chrome"
    else if (userAgent.includes("Firefox")) browser = "Firefox"
    else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari"
    else if (userAgent.includes("Edge")) browser = "Edge"

    if (userAgent.includes("Windows")) os = "Windows"
    else if (userAgent.includes("Mac")) os = "macOS"
    else if (userAgent.includes("Linux")) os = "Linux"
    else if (userAgent.includes("Android")) os = "Android"
    else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS"

    return { browser, os }
}

function buildDescription(log: AuditLogEntry, tFn?: (key: string) => string): string {
    const t = tFn || ((k: string) => k)
    const actor = log.performedBy?.name || log.performedBy?.email || "System"
    const entity = log.entityType.replace(/([A-Z])/g, " $1").trim()
    const actionMap: Record<string, string> = {
        create: t("actionCreated"),
        update: t("actionUpdated"),
        delete: t("actionDeleted"),
        login: t("actionLogin"),
        approve: "approved",
        reject: "rejected",
        view: "viewed",
        export: "exported",
    }
    const verb = actionMap[log.action] || log.action
    if (log.action === "login") return `${actor} ${verb}`
    return `${actor} ${verb} ${entity}`
}

// ═══════════════════════════════════════════════════════════════════════
// Diff Viewer Component
// ═══════════════════════════════════════════════════════════════════════

function DiffViewer({ oldValues, newValues }: { oldValues: string | null; newValues: string | null }) {
    const oldObj = useMemo(() => {
        try { return oldValues ? JSON.parse(oldValues) : null } catch { return null }
    }, [oldValues])

    const newObj = useMemo(() => {
        try { return newValues ? JSON.parse(newValues) : null } catch { return null }
    }, [newValues])

    if (!oldObj && !newObj) {
        return (
            <div className="text-center py-8 text-muted-foreground text-sm">
                No change data recorded for this action.
            </div>
        )
    }

    // Collect all keys
    const allKeys = new Set([
        ...Object.keys(oldObj || {}),
        ...Object.keys(newObj || {}),
    ])

    // Filter out internal/meta fields
    const filteredKeys = [...allKeys].filter(k =>
        !["id", "createdAt", "updatedAt", "organizationId", "userId"].includes(k)
    )

    if (filteredKeys.length === 0) {
        return (
            <div className="text-center py-6 text-muted-foreground text-sm">
                Only system fields were modified.
            </div>
        )
    }

    return (
        <div className="space-y-0 divide-y divide-white/5">
            {filteredKeys.map(key => {
                const oldVal = oldObj?.[key]
                const newVal = newObj?.[key]
                const isAdded = oldVal === undefined && newVal !== undefined
                const isRemoved = oldVal !== undefined && newVal === undefined
                const isChanged = !isAdded && !isRemoved && JSON.stringify(oldVal) !== JSON.stringify(newVal)

                if (!isAdded && !isRemoved && !isChanged) return null

                return (
                    <div key={key} className="py-2.5 px-1 grid grid-cols-[140px_1fr_auto_1fr] gap-3 items-start text-xs">
                        <div className="font-medium text-muted-foreground truncate font-mono">
                            {key}
                        </div>
                        <div className={`font-mono break-all ${isRemoved ? "text-red-400" : isChanged ? "text-red-400/70 line-through" : "text-muted-foreground/40"}`}>
                            {oldVal !== undefined ? (typeof oldVal === "object" ? JSON.stringify(oldVal) : String(oldVal)) : "—"}
                        </div>
                        <div className="flex items-center justify-center">
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <div className={`font-mono break-all ${isAdded ? "text-emerald-400" : isChanged ? "text-emerald-400" : "text-muted-foreground/40"}`}>
                            {newVal !== undefined ? (typeof newVal === "object" ? JSON.stringify(newVal) : String(newVal)) : "—"}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════
// Main Chronicle Page
// ═══════════════════════════════════════════════════════════════════════

export default function AuditLogsPage() {
    const t = useTranslations("AuditLogs")
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [stats, setStats] = useState<AuditStats>({ total: 0, todayCount: 0, criticalCount: 0, activeUsers: 0 })
    const [filterOptions, setFilterOptions] = useState<AuditFilters>({ actions: [], entityTypes: [] })
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [search, setSearch] = useState("")
    const [actionFilter, setActionFilter] = useState("")
    const [entityFilter, setEntityFilter] = useState("")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [exporting, setExporting] = useState(false)
    const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
    const [mounted, setMounted] = useState(false)
    const limit = 20

    useEffect(() => { setMounted(true) }, [])

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
            if (search) params.append("search", search)
            if (actionFilter) params.append("action", actionFilter)
            if (entityFilter) params.append("entityType", entityFilter)
            if (dateFrom) params.append("dateFrom", dateFrom)
            if (dateTo) params.append("dateTo", dateTo)

            const res = await fetch(`/api/audit-logs?${params}`)
            if (res.ok) {
                const data = await res.json()
                setLogs(data.logs || [])
                setStats(data.stats || { total: 0, todayCount: 0, criticalCount: 0, activeUsers: 0 })
                setFilterOptions(data.filters || { actions: [], entityTypes: [] })
                setTotal(data.pagination?.total || 0)
                setTotalPages(data.pagination?.totalPages || 1)
            }
        } catch (error) {
            console.error("Failed to fetch audit logs:", error)
        } finally {
            setLoading(false)
        }
    }, [page, search, actionFilter, entityFilter, dateFrom, dateTo])

    useEffect(() => { fetchLogs() }, [fetchLogs])

    const handleSearch = () => { setPage(1); fetchLogs() }
    const clearFilters = () => {
        setSearch("")
        setActionFilter("")
        setEntityFilter("")
        setDateFrom("")
        setDateTo("")
        setPage(1)
    }
    const hasFilters = !!(search || actionFilter || entityFilter || dateFrom || dateTo)

    const handleExport = async () => {
        setExporting(true)
        try {
            const params = new URLSearchParams({ format: "csv" })
            if (actionFilter) params.append("action", actionFilter)
            if (entityFilter) params.append("entityType", entityFilter)
            if (dateFrom) params.append("dateFrom", dateFrom)
            if (dateTo) params.append("dateTo", dateTo)

            const res = await fetch(`/api/audit-logs?${params}`)
            if (res.ok) {
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `audit-chronicle-${new Date().toISOString().split("T")[0]}.csv`
                a.click()
                URL.revokeObjectURL(url)
            }
        } catch (error) {
            console.error("Export failed:", error)
        } finally {
            setExporting(false)
        }
    }

    // Recent critical actions for timeline
    const recentCritical = useMemo(() => {
        return logs.filter(l => ["delete", "create", "approve", "reject"].includes(l.action)).slice(0, 5)
    }, [logs])

    // ── Loading Skeleton ─────────────────────────────────────────────
    if (loading && logs.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-slate-500 to-zinc-600 flex items-center justify-center shadow-lg">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <div>
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-4 w-64 mt-1" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
                    ))}
                </div>
                <Card><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
                {[...Array(6)].map((_, i) => (
                    <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* ═══════════════════════════════════════════════════════════════
                HERO HEADER
            ═══════════════════════════════════════════════════════════════ */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-slate-600 via-zinc-700 to-slate-800 flex items-center justify-center shadow-xl shadow-slate-500/15">
                            <Fingerprint className="w-6 h-6 text-white" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight bg-linear-to-r from-slate-200 via-zinc-300 to-slate-400 bg-clip-text text-transparent">
                            {t('title')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={handleExport}
                    disabled={exporting}
                    className="gap-2 shrink-0"
                >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {t('exportCSV')}
                </Button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                PREMIUM STAT CARDS
            ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Logs */}
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-br from-slate-500/10 via-zinc-500/5 to-transparent" />
                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <CardContent className="relative pt-5 pb-4">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2 rounded-xl bg-linear-to-br from-slate-500/20 to-zinc-500/20">
                                <ScrollText className="w-4.5 h-4.5 text-slate-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('totalLogs')}</p>
                        <p className="text-2xl font-display font-bold mt-1">{stats.total.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('totalLogsDesc')}</p>
                    </CardContent>
                </Card>

                {/* Today */}
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-br from-blue-500/10 via-blue-500/5 to-transparent" />
                    <CardContent className="relative pt-5 pb-4">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2 rounded-xl bg-linear-to-br from-blue-500/20 to-indigo-500/20">
                                <Clock className="w-4.5 h-4.5 text-blue-400" />
                            </div>
                            {stats.todayCount > 0 && (
                                <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-[10px]">
                                    <Activity className="w-3 h-3 mr-1" /> {t('live')}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('today')}</p>
                        <p className="text-2xl font-display font-bold text-blue-400 mt-1">{stats.todayCount}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('todayDesc')}</p>
                    </CardContent>
                </Card>

                {/* Critical */}
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-transparent" />
                    <CardContent className="relative pt-5 pb-4">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2 rounded-xl bg-linear-to-br from-amber-500/20 to-orange-500/20">
                                <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('critical')}</p>
                        <p className="text-2xl font-display font-bold text-amber-400 mt-1">{stats.criticalCount}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('criticalDesc')}</p>
                    </CardContent>
                </Card>

                {/* Active Users */}
                <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-transparent" />
                    <CardContent className="relative pt-5 pb-4">
                        <div className="flex items-start justify-between mb-2">
                            <div className="p-2 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20">
                                <UserCheck className="w-4.5 h-4.5 text-emerald-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('activeUsers')}</p>
                        <p className="text-2xl font-display font-bold text-emerald-400 mt-1">{stats.activeUsers}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('activeUsersDesc')}</p>
                    </CardContent>
                </Card>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                LIVE ACTIVITY TIMELINE (Top critical actions)
            ═══════════════════════════════════════════════════════════════ */}
            {recentCritical.length > 0 && (
                <Card className="border-slate-500/15">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400" />
                            {t('liveActivity')}
                        </CardTitle>
                        <CardDescription className="text-xs">{t('liveActivityDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-linear-to-b from-slate-500/30 via-slate-500/10 to-transparent" />

                            <div className="space-y-3">
                                {recentCritical.map((log) => {
                                    const config = actionConfig[log.action] || defaultActionConfig
                                    const ActionIcon = config.icon
                                    return (
                                        <button
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            className="relative flex items-start gap-3 pl-1 w-full text-left hover:bg-muted/30 rounded-lg transition-colors p-2 -ml-1"
                                        >
                                            {/* Timeline dot */}
                                            <div className={`relative z-10 w-[22px] h-[22px] rounded-full ${config.bgClass} flex items-center justify-center shrink-0 mt-0.5 ring-2 ring-background`}>
                                                <ActionIcon className={`w-3 h-3 ${config.textClass}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-foreground truncate">
                                                    {buildDescription(log, t)}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge className={`${config.bgClass} ${config.textClass} text-[9px] uppercase border-0 px-1.5 py-0`}>
                                                        {log.action}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
                                                        {mounted ? getRelativeTime(log.createdAt) : ""}
                                                    </span>
                                                </div>
                                            </div>
                                            <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 mt-1" />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                ADVANCED FILTER BAR
            ═══════════════════════════════════════════════════════════════ */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                        {/* Row 1: Search + Quick filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('searchPlaceholder')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                    className="pl-9 h-10"
                                />
                            </div>
                            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setPage(1) }}>
                                <SelectTrigger className="w-full sm:w-[160px] h-10">
                                    <SelectValue placeholder={t('allActions')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('allActions')}</SelectItem>
                                    {filterOptions.actions.map(a => (
                                        <SelectItem key={a} value={a}>
                                            <span className="flex items-center gap-2 capitalize">
                                                <div className={`w-2 h-2 rounded-full ${(actionConfig[a] || defaultActionConfig).dotColor}`} />
                                                {a}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v === "all" ? "" : v); setPage(1) }}>
                                <SelectTrigger className="w-full sm:w-[180px] h-10">
                                    <SelectValue placeholder={t('allEntities')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('allEntities')}</SelectItem>
                                    {filterOptions.entityTypes.map(e => (
                                        <SelectItem key={e} value={e}>{e}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Row 2: Date range + Clear */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" />
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                                    className="h-9 w-[150px] text-xs"
                                />
                                <span className="text-xs text-muted-foreground">{t('to')}</span>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                                    className="h-9 w-[150px] text-xs"
                                />
                            </div>
                            {hasFilters && (
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground hover:text-foreground h-8">
                                    <X className="w-3.5 h-3.5" />
                                    {t('clearFilters')}
                                </Button>
                            )}
                            <div className="sm:ml-auto text-xs text-muted-foreground">
                                {t('showingEntries', { from: ((page - 1) * limit) + 1, to: Math.min(page * limit, total), total })}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════════════
                PREMIUM LOG TABLE
            ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-2">
                {loading ? (
                    [...Array(8)].map((_, i) => (
                        <Card key={i}><CardContent className="p-4"><div className="flex items-center gap-4"><Skeleton className="h-8 w-8 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-[60%]" /><Skeleton className="h-3 w-[40%]" /></div><Skeleton className="h-5 w-14 rounded-full" /></div></CardContent></Card>
                    ))
                ) : logs.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-16">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="relative mb-6">
                                    <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-slate-500/20 to-zinc-500/20 flex items-center justify-center">
                                        <ScrollText className="w-10 h-10 text-slate-500" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                                        <Shield className="w-4 h-4 text-emerald-500" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-semibold">{t('noLogsFound')}</h3>
                                <p className="text-muted-foreground mt-2 max-w-md leading-relaxed">
                                    {t('noLogsDesc')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    logs.map((log) => {
                        const config = actionConfig[log.action] || defaultActionConfig
                        const ActionIcon = config.icon
                        const device = parseDeviceInfo(log.userAgent)
                        const hasData = !!(log.oldValues || log.newValues)

                        return (
                            <Card
                                key={log.id}
                                className="group hover:border-slate-500/20 transition-all cursor-pointer"
                                onClick={() => setSelectedLog(log)}
                            >
                                <CardContent className="p-0">
                                    <div className="flex items-center gap-4 p-4">
                                        {/* Action Icon */}
                                        <div className={`w-9 h-9 rounded-xl bg-linear-to-br ${config.gradient} flex items-center justify-center shrink-0`}>
                                            <ActionIcon className={`w-4 h-4 ${config.textClass}`} />
                                        </div>

                                        {/* Description */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {buildDescription(log, t)}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <Badge className={`${config.bgClass} ${config.textClass} text-[9px] uppercase border-0 px-1.5 py-0`}>
                                                    {log.action}
                                                </Badge>
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                                    {log.entityType}
                                                </Badge>
                                                {log.ipAddress && (
                                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <Globe className="w-3 h-3" />
                                                        {log.ipAddress}
                                                    </span>
                                                )}
                                                {log.userAgent && (
                                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <Monitor className="w-3 h-3" />
                                                        {device.browser} · {device.os}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Timestamp + View */}
                                        <div className="text-right shrink-0 flex items-center gap-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                                                    {mounted ? getRelativeTime(log.createdAt) : ""}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/60 mt-0.5" suppressHydrationWarning>
                                                    {mounted ? new Date(log.createdAt).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" }) : ""}
                                                </p>
                                            </div>
                                            {hasData && (
                                                <div className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                PAGINATION
            ═══════════════════════════════════════════════════════════════ */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        {t('showingEntries', { from: ((page - 1) * limit) + 1, to: Math.min(page * limit, total), total })}
                    </p>
                    <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                            const p = page <= 3 ? i + 1 : page - 2 + i
                            if (p > totalPages || p < 1) return null
                            return (
                                <Button
                                    key={p}
                                    variant={p === page ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setPage(p)}
                                    className="h-8 w-8 p-0 text-xs"
                                >
                                    {p}
                                </Button>
                            )
                        })}
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                LOG DETAIL DIALOG (Premium Diff Viewer)
            ═══════════════════════════════════════════════════════════════ */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-xl bg-linear-to-br ${(actionConfig[selectedLog?.action || ""] || defaultActionConfig).gradient} flex items-center justify-center`}>
                                {(() => {
                                    const Icon = (actionConfig[selectedLog?.action || ""] || defaultActionConfig).icon
                                    return <Icon className={`w-4.5 h-4.5 ${(actionConfig[selectedLog?.action || ""] || defaultActionConfig).textClass}`} />
                                })()}
                            </div>
                            {t('logDetail')}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedLog && buildDescription(selectedLog, t)}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="flex-1 overflow-y-auto space-y-4 py-4 min-h-0 pr-1">
                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border bg-muted/20 p-3">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('action')}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className={`${(actionConfig[selectedLog.action] || defaultActionConfig).bgClass} ${(actionConfig[selectedLog.action] || defaultActionConfig).textClass} text-xs uppercase border-0`}>
                                            {selectedLog.action}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="rounded-xl border bg-muted/20 p-3">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('entity')}</p>
                                    <p className="text-sm font-medium mt-1">{selectedLog.entityType}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{selectedLog.entityId}</p>
                                </div>
                                <div className="rounded-xl border bg-muted/20 p-3">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('performedBy')}</p>
                                    <p className="text-sm font-medium mt-1">{selectedLog.performedBy?.name || "System"}</p>
                                    <p className="text-[10px] text-muted-foreground">{selectedLog.performedBy?.email || ""}</p>
                                </div>
                                <div className="rounded-xl border bg-muted/20 p-3">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('timestamp')}</p>
                                    <p className="text-sm font-medium mt-1" suppressHydrationWarning>
                                        {mounted ? new Date(selectedLog.createdAt).toLocaleString("en-BD") : ""}
                                    </p>
                                </div>
                            </div>

                            {/* Security Info */}
                            {(selectedLog.ipAddress || selectedLog.userAgent) && (
                                <div className="rounded-xl border bg-muted/20 p-3">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                                        <ShieldAlert className="w-3 h-3 inline mr-1" />
                                        {t('securityInfo')}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        {selectedLog.ipAddress && (
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                                <span className="font-mono text-foreground">{selectedLog.ipAddress}</span>
                                            </div>
                                        )}
                                        {selectedLog.userAgent && (() => {
                                            const d = parseDeviceInfo(selectedLog.userAgent)
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="text-foreground">{d.browser} · {d.os}</span>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Diff Viewer */}
                            <div className="rounded-xl border overflow-hidden">
                                <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('changes')}</span>
                                    {selectedLog.oldValues && (
                                        <Badge variant="outline" className="text-[9px] ml-auto">
                                            {t('beforeAfter')}
                                        </Badge>
                                    )}
                                </div>
                                <div className="px-4 py-2">
                                    <DiffViewer
                                        oldValues={selectedLog.oldValues}
                                        newValues={selectedLog.newValues}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
