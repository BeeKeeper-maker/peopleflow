"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Gift,
    Plus,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Users,
    Calendar,
    TrendingUp,
    Sparkles,
    Clock,
    Banknote,
    Zap,
    ShieldCheck,
    UserCheck,
    UserX,
    ChevronRight,
    Star,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BonusConfig {
    configId: string
    name: string
    festivalType: string
    year: number
    status: string
    totalPayments: number
    totalAmount: number
    pendingCount: number
    paidCount: number
}

interface GenerateResult {
    configName: string
    totalEligible: number
    totalIneligible: number
    totalAmount: number
    payments: Array<{
        employeeName: string
        employeeCode: string
        amount: number
        basisAmount: number
        percentageApplied: number
        proRataFactor: number
        isProRated: boolean
    }>
    ineligibleReasons: Array<{
        employeeName: string
        reason: string
    }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const festivalTypes = [
    { value: "eid_ul_fitr", label: "Eid-ul-Fitr", emoji: "🌙" },
    { value: "eid_ul_adha", label: "Eid-ul-Adha", emoji: "🐑" },
    { value: "durga_puja", label: "Durga Puja", emoji: "🪷" },
    { value: "christmas", label: "Christmas", emoji: "🎄" },
    { value: "new_year", label: "New Year", emoji: "🎉" },
    { value: "other", label: "Other", emoji: "🎁" },
]

const statusConfig: Record<string, { label: string; color: string; dotColor: string; icon: typeof Clock }> = {
    draft: {
        label: "Draft",
        color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
        dotColor: "bg-zinc-400",
        icon: Clock,
    },
    generated: {
        label: "Generated",
        color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        dotColor: "bg-amber-400",
        icon: Zap,
    },
    approved: {
        label: "Approved",
        color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        dotColor: "bg-emerald-400",
        icon: ShieldCheck,
    },
    paid: {
        label: "Paid",
        color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        dotColor: "bg-blue-400",
        icon: CheckCircle2,
    },
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedValue({ value, prefix = "৳" }: { value: number; prefix?: string }) {
    const [display, setDisplay] = useState(0)
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        if (!mounted) return
        const start = performance.now()
        const from = display
        const animate = (now: number) => {
            const p = Math.min((now - start) / 1000, 1)
            const eased = 1 - Math.pow(1 - p, 3)
            setDisplay(Math.round(from + (value - from) * eased))
            if (p < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, mounted])

    return (
        <span className="tabular-nums" suppressHydrationWarning>
            {prefix}{mounted ? display.toLocaleString() : "0"}
        </span>
    )
}

// ─── Constants (hydration-safe: computed once at module level) ────────────────

const CURRENT_YEAR = 2026 // Static to avoid SSR/CSR mismatch from new Date()

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FestivalBonusPage() {
    const [configs, setConfigs] = useState<BonusConfig[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [showResultDialog, setShowResultDialog] = useState(false)
    const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [isGenerating, setIsGenerating] = useState<string | null>(null)
    const [resultTab, setResultTab] = useState<"eligible" | "ineligible">("eligible")
    const [mounted, setMounted] = useState(false)
    const { addToast } = useToast()
    const t = useTranslations('FestivalBonus')

    useEffect(() => { setMounted(true) }, [])

    const [formData, setFormData] = useState({
        name: "",
        festivalType: "eid_ul_fitr",
        year: CURRENT_YEAR,
        percentageOfBasis: 100,
        calculationBasis: "basic",
        minimumServiceDays: 0,
        proRataForNewJoinee: true,
        includeProbation: false,
        includeContractual: false,
    })

    const fetchConfigs = useCallback(async () => {
        try {
            const res = await fetch("/api/payroll/festival-bonus")
            if (res.ok) {
                const json = await res.json()
                setConfigs(json.data || [])
            }
        } catch (error) {
            console.error("Failed to fetch configs:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchConfigs() }, [fetchConfigs])

    const handleCreate = async () => {
        if (!formData.name.trim()) {
            addToast({ title: "Please enter a config name", type: "error" })
            return
        }
        setIsCreating(true)
        try {
            const res = await fetch("/api/payroll/festival-bonus", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })
            if (res.ok) {
                addToast({ title: "Bonus configuration created", type: "success" })
                setShowCreateDialog(false)
                setFormData({
                    name: "", festivalType: "eid_ul_fitr", year: CURRENT_YEAR,
                    percentageOfBasis: 100, calculationBasis: "basic", minimumServiceDays: 0,
                    proRataForNewJoinee: true, includeProbation: false, includeContractual: false,
                })
                fetchConfigs()
            } else {
                const err = await res.json()
                addToast({ title: err.error || "Failed to create", type: "error" })
            }
        } catch {
            addToast({ title: "Failed to create bonus config", type: "error" })
        } finally {
            setIsCreating(false)
        }
    }

    const handleGenerate = async (configId: string) => {
        setIsGenerating(configId)
        try {
            const res = await fetch("/api/payroll/festival-bonus", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "generate", bonusConfigId: configId }),
            })
            if (res.ok) {
                const json = await res.json()
                setGenerateResult(json.data)
                setResultTab("eligible")
                setShowResultDialog(true)
                addToast({ title: `Bonus generated for ${json.data.totalEligible} employees`, type: "success" })
                fetchConfigs()
            } else {
                const err = await res.json()
                addToast({ title: err.error || "Generation failed", type: "error" })
            }
        } catch {
            addToast({ title: "Failed to generate bonus", type: "error" })
        } finally {
            setIsGenerating(null)
        }
    }

    const totalBudget = useMemo(() => configs.reduce((sum, c) => sum + c.totalAmount, 0), [configs])
    const totalPayments = useMemo(() => configs.reduce((sum, c) => sum + c.totalPayments, 0), [configs])
    const pendingPayments = useMemo(() => configs.reduce((sum, c) => sum + c.pendingCount, 0), [configs])

    const getFestivalEmoji = (type: string) => festivalTypes.find((f) => f.value === type)?.emoji || "🎁"
    const getFestivalLabel = (type: string) => festivalTypes.find((f) => f.value === type)?.label || type.replace(/_/g, " ")

    // ─── Loading Skeleton ─────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Gift className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight">Festival Bonus</h1>
                        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="overflow-hidden">
                            <CardContent className="pt-6">
                                <div className="space-y-3 animate-pulse">
                                    <div className="h-3 w-24 bg-muted rounded" />
                                    <div className="h-8 w-32 bg-muted rounded" />
                                    <div className="h-2 w-16 bg-muted rounded" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-4 animate-pulse">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-16 bg-muted/40 rounded-xl" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* ── Hero Header ── */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                            <Gift className="w-6 h-6 text-white" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-background flex items-center justify-center">
                            <Star className="w-2 h-2 text-amber-900" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight bg-linear-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                            {t('title')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2 bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20 border-0">
                    <Plus className="w-4 h-4" /> {t('newConfig')}
                </Button>
            </div>

            {/* ── Premium Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Configs */}
                <Card className="relative overflow-hidden group hover:border-amber-500/20 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-amber-500/10">
                                <Gift className="w-5 h-5 text-amber-400" />
                            </div>
                            {configs.length > 0 && mounted && (
                                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                    {CURRENT_YEAR}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('totalConfigs')}</p>
                        <p className="text-2xl font-display font-bold mt-1 tabular-nums">{configs.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('configsDesc')}</p>
                    </CardContent>
                </Card>

                {/* Total Budget */}
                <Card className="relative overflow-hidden border-emerald-500/20">
                    <div className="absolute inset-0 bg-linear-to-br from-emerald-500/8 via-transparent to-transparent" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 shadow-lg shadow-emerald-500/10">
                                <Banknote className="w-5 h-5 text-emerald-400" />
                            </div>
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">
                                <TrendingUp className="w-3 h-3 mr-0.5" /> {t('totalBudget')}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('totalBudget')}</p>
                        <p className="text-2xl font-display font-bold text-emerald-400 mt-1 tabular-nums">
                            <AnimatedValue value={totalBudget} />
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('budgetDesc')}</p>
                    </CardContent>
                </Card>

                {/* Total Employees */}
                <Card className="relative overflow-hidden group hover:border-blue-500/20 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-blue-500/10">
                                <Users className="w-5 h-5 text-blue-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Payments</p>
                        <p className="text-2xl font-display font-bold mt-1 tabular-nums">{totalPayments}</p>
                        <div className="mt-2">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-linear-to-r from-blue-500 to-blue-400 transition-all duration-1000"
                                    style={{ width: `${totalPayments > 0 && pendingPayments > 0 ? Math.max(((totalPayments - pendingPayments) / totalPayments) * 100, 5) : totalPayments > 0 ? 100 : 0}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                {totalPayments - pendingPayments} processed
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Pending */}
                <Card className="relative overflow-hidden group hover:border-violet-500/20 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-violet-500/10">
                                <Clock className="w-5 h-5 text-violet-400" />
                            </div>
                            {pendingPayments > 0 && (
                                <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/20 text-[10px] animate-pulse">
                                    Action needed
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('eligibleEmployees')}</p>
                        <p className="text-2xl font-display font-bold mt-1 tabular-nums">{pendingPayments}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('eligibleDesc')}</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Config Cards Grid (replaces plain table) ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            {t('configTitle')}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('configSubtitle')}</p>
                    </div>
                </div>

                {configs.length === 0 ? (
                    <Card className="border-dashed overflow-hidden">
                        <CardContent className="py-20">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="relative mb-6">
                                    <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                                        <Gift className="w-10 h-10 text-amber-500" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-emerald-500" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-semibold">{t('emptyTitle')}</h3>
                                <p className="text-muted-foreground mt-2 max-w-md leading-relaxed">
                                    {t('emptyDescription')}
                                </p>
                                <Button
                                    onClick={() => setShowCreateDialog(true)}
                                    className="mt-5 gap-2 bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0"
                                >
                                    <Plus className="w-4 h-4" /> {t('emptyAction')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {configs.map((config) => {
                            const status = statusConfig[config.status] || statusConfig.draft
                            const StatusIcon = status.icon
                            const emoji = getFestivalEmoji(config.festivalType)
                            const isProcessing = isGenerating === config.configId

                            return (
                                <Card key={config.configId} className="group overflow-hidden hover:border-white/10 transition-all">
                                    <CardContent className="p-0">
                                        <div className="flex items-center gap-5 px-5 py-4">
                                            {/* Festival Icon */}
                                            <div className="shrink-0 w-12 h-12 rounded-xl bg-linear-to-br from-amber-500/15 to-orange-500/15 flex items-center justify-center text-2xl">
                                                {emoji}
                                            </div>

                                            {/* Name & Meta */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-sm truncate">{config.name}</h3>
                                                    <Badge className={`${status.color} text-[10px] gap-1`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {status.label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {getFestivalLabel(config.festivalType)} {config.year}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">•</span>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Users className="w-3 h-3" />
                                                        {config.totalPayments} employees
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Amount */}
                                            <div className="text-right shrink-0 mr-4">
                                                <p className="text-lg font-display font-bold tabular-nums" suppressHydrationWarning>
                                                    {mounted ? `৳${config.totalAmount.toLocaleString()}` : `৳${config.totalAmount}`}
                                                </p>
                                                {config.pendingCount > 0 && (
                                                    <p className="text-[10px] text-amber-400">
                                                        {config.pendingCount} pending
                                                    </p>
                                                )}
                                                {config.paidCount > 0 && config.pendingCount === 0 && (
                                                    <p className="text-[10px] text-emerald-400">
                                                        All paid ✓
                                                    </p>
                                                )}
                                            </div>

                                            {/* Action */}
                                            <div className="shrink-0">
                                                {config.status === "draft" ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleGenerate(config.configId)}
                                                        disabled={isProcessing}
                                                        className="gap-1.5 bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0 shadow-lg shadow-amber-500/15 min-w-[110px]"
                                                    >
                                                        {isProcessing ? (
                                                            <>
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                <span>{t('generating')}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Zap className="w-3.5 h-3.5" />
                                                                <span>{t('generate')}</span>
                                                            </>
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Subtle progress bar at bottom */}
                                        {config.totalPayments > 0 && (
                                            <div className="h-0.5 bg-muted">
                                                <div
                                                    className="h-full bg-linear-to-r from-amber-500 to-emerald-500 transition-all duration-700"
                                                    style={{ width: `${config.totalPayments > 0 ? ((config.paidCount / config.totalPayments) * 100) : 0}%` }}
                                                />
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Create Config Dialog (Premium) ── */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                                <Gift className="w-4.5 h-4.5 text-amber-400" />
                            </div>
                            New Bonus Configuration
                        </DialogTitle>
                        <DialogDescription>
                            {t('createDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-5 py-4">
                        {/* Config Name */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('configName')}</Label>
                            <Input
                                placeholder={t('configNamePlaceholder')}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="h-11"
                            />
                        </div>

                        {/* Festival Type + Year */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('festivalName')}</Label>
                                <Select value={formData.festivalType} onValueChange={(v) => setFormData({ ...formData, festivalType: v })}>
                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {festivalTypes.map((f) => (
                                            <SelectItem key={f.value} value={f.value}>
                                                <span className="flex items-center gap-2">{f.emoji} {f.label}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('year')}</Label>
                                <Input
                                    type="number"
                                    value={formData.year}
                                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                    className="h-11"
                                />
                            </div>
                        </div>

                        {/* Percentage + Basis */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('bonusValue')}</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={formData.percentageOfBasis}
                                        onChange={(e) => setFormData({ ...formData, percentageOfBasis: parseFloat(e.target.value) })}
                                        className="h-11 pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('bonusTypeLabel')}</Label>
                                <Select value={formData.calculationBasis} onValueChange={(v) => setFormData({ ...formData, calculationBasis: v })}>
                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="basic">Basic Salary</SelectItem>
                                        <SelectItem value="gross">Gross Salary</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Min Service Days */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('minServiceMonths')}</Label>
                            <Input
                                type="number"
                                value={formData.minimumServiceDays}
                                onChange={(e) => setFormData({ ...formData, minimumServiceDays: parseInt(e.target.value) })}
                                className="h-11"
                                placeholder="0 = no minimum"
                            />
                        </div>

                        {/* Toggles */}
                        <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t('eligibilityLabel')}</p>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-amber-400" />
                                    <Label className="text-sm">Pro-rata for new joiners (&lt;1 year)</Label>
                                </div>
                                <Switch checked={formData.proRataForNewJoinee} onCheckedChange={(v) => setFormData({ ...formData, proRataForNewJoinee: v })} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-blue-400" />
                                    <Label className="text-sm">Include probation employees</Label>
                                </div>
                                <Switch checked={formData.includeProbation} onCheckedChange={(v) => setFormData({ ...formData, includeProbation: v })} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-violet-400" />
                                    <Label className="text-sm">Include contractual employees</Label>
                                </div>
                                <Switch checked={formData.includeContractual} onCheckedChange={(v) => setFormData({ ...formData, includeContractual: v })} />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('cancel')}</Button>
                        <Button
                            onClick={handleCreate}
                            disabled={isCreating || !formData.name.trim()}
                            className="gap-2 bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0 min-w-[140px]"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('creating')}
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    {t('create')}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Generation Result Dialog (Premium) ── */}
            <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            </div>
                            Generation Complete
                        </DialogTitle>
                        <DialogDescription>
                            {generateResult?.configName} — review the results below
                        </DialogDescription>
                    </DialogHeader>

                    {generateResult && (
                        <div className="flex-1 overflow-hidden flex flex-col gap-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl bg-linear-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/10 p-4 text-center">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center mx-auto mb-2">
                                        <UserCheck className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <p className="text-2xl font-display font-bold text-emerald-400 tabular-nums">{generateResult.totalEligible}</p>
                                    <p className="text-[11px] text-muted-foreground">{t('resultEligible')}</p>
                                </div>
                                <div className="rounded-xl bg-linear-to-br from-red-500/10 to-red-500/5 border border-red-500/10 p-4 text-center">
                                    <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center mx-auto mb-2">
                                        <UserX className="w-4 h-4 text-red-400" />
                                    </div>
                                    <p className="text-2xl font-display font-bold text-red-400 tabular-nums">{generateResult.totalIneligible}</p>
                                    <p className="text-[11px] text-muted-foreground">{t('resultIneligible')}</p>
                                </div>
                                <div className="rounded-xl bg-linear-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/10 p-4 text-center">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center mx-auto mb-2">
                                        <Banknote className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <p className="text-2xl font-display font-bold text-blue-400" suppressHydrationWarning>৳{generateResult.totalAmount.toLocaleString()}</p>
                                    <p className="text-[11px] text-muted-foreground">Total Amount</p>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
                                <button
                                    onClick={() => setResultTab("eligible")}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                        resultTab === "eligible"
                                            ? "bg-card text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <UserCheck className="w-3 h-3 inline mr-1" />
                                    {t('resultEligible')} ({generateResult.payments.length})
                                </button>
                                <button
                                    onClick={() => setResultTab("ineligible")}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                        resultTab === "ineligible"
                                            ? "bg-card text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <UserX className="w-3 h-3 inline mr-1" />
                                    {t('resultIneligible')} ({generateResult.ineligibleReasons.length})
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto min-h-0 rounded-xl border">
                                {resultTab === "eligible" && generateResult.payments.length > 0 && (
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="text-[10px] uppercase tracking-wider font-semibold">{t('employee')}</TableHead>
                                                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-right">Basis</TableHead>
                                                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-right">Rate</TableHead>
                                                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-right">{t('bonusAmount')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {generateResult.payments.map((p, i) => (
                                                <TableRow key={i} className="border-b border-white/3">
                                                    <TableCell className="py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-amber-500/15 to-orange-500/15 flex items-center justify-center">
                                                                <span className="text-[10px] font-bold text-amber-400">
                                                                    {p.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-medium">{p.employeeName}</span>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <code className="text-[10px] text-muted-foreground">{p.employeeCode}</code>
                                                                    {p.isProRated && (
                                                                        <Badge className="text-[9px] py-0 px-1 bg-amber-500/10 text-amber-400 border-amber-500/20">
                                                                            Pro-rata {Math.round(p.proRataFactor * 100)}%
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm tabular-nums" suppressHydrationWarning>
                                                        ৳{p.basisAmount.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-muted-foreground">
                                                        {p.percentageApplied.toFixed(0)}%
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-semibold text-emerald-400 tabular-nums" suppressHydrationWarning>
                                                        ৳{p.amount.toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}

                                {resultTab === "eligible" && generateResult.payments.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <UserX className="w-8 h-8 text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">No eligible employees found</p>
                                    </div>
                                )}

                                {resultTab === "ineligible" && generateResult.ineligibleReasons.length > 0 && (
                                    <div className="divide-y divide-white/5">
                                        {generateResult.ineligibleReasons.map((r, i) => (
                                            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-red-500/3 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                                                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                                    </div>
                                                    <span className="text-sm font-medium">{r.employeeName}</span>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/20 bg-red-500/5">
                                                    {r.reason}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {resultTab === "ineligible" && generateResult.ineligibleReasons.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                                        <p className="text-sm text-muted-foreground">All employees were eligible!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setShowResultDialog(false)}>{t('close')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
