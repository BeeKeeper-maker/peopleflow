"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Clock,
    Plus,
    Loader2,
    Shield,
    CheckCircle2,
    Trash2,
    Layers,
    Timer,
    ArrowRight,
    Zap,
    AlertTriangle,
    ShieldAlert,
    Minus,
    Ban,
    CircleDot,
    Sparkles,
    Info,
    ChevronRight,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tier {
    name: string
    fromCount: number
    toCount: number
    deductionType: string
    deductionValue: number
    issueWarning: boolean
    warningLevel: string
}

interface Policy {
    id: string
    name: string
    lateThresholdMinutes: number
    isActive: boolean
    createdAt: string
    tiers: Array<{
        id: string
        tierOrder: number
        name: string
        fromCount: number
        toCount: number
        deductionType: string
        deductionValue: number
        issueWarning: boolean
        warningLevel: string
    }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const deductionTypes = [
    { value: "none", label: "No Deduction (Grace)", shortLabel: "Grace" },
    { value: "half_day", label: "Half-Day Salary Cut", shortLabel: "½ Day Cut" },
    { value: "full_day", label: "Full-Day Salary Cut", shortLabel: "Full Day Cut" },
    { value: "fixed_amount", label: "Fixed Amount (BDT)", shortLabel: "Fixed BDT" },
    { value: "percentage_of_daily", label: "% of Daily Salary", shortLabel: "% Daily" },
]

const warningLevels = [
    { value: "verbal", label: "Verbal Warning", emoji: "💬" },
    { value: "written", label: "Written Warning", emoji: "📝" },
    { value: "final", label: "Final Warning", emoji: "🚨" },
]

interface TierStyle {
    bg: string
    border: string
    text: string
    dot: string
    icon: typeof Clock
    glow: string
}

const tierStyles: Record<string, TierStyle> = {
    none: {
        bg: "from-emerald-500/12 to-emerald-500/4",
        border: "border-emerald-500/20",
        text: "text-emerald-400",
        dot: "bg-emerald-400",
        icon: Shield,
        glow: "shadow-emerald-500/10",
    },
    half_day: {
        bg: "from-amber-500/12 to-amber-500/4",
        border: "border-amber-500/20",
        text: "text-amber-400",
        dot: "bg-amber-400",
        icon: Minus,
        glow: "shadow-amber-500/10",
    },
    full_day: {
        bg: "from-red-500/12 to-red-500/4",
        border: "border-red-500/20",
        text: "text-red-400",
        dot: "bg-red-400",
        icon: Ban,
        glow: "shadow-red-500/10",
    },
    fixed_amount: {
        bg: "from-violet-500/12 to-violet-500/4",
        border: "border-violet-500/20",
        text: "text-violet-400",
        dot: "bg-violet-400",
        icon: CircleDot,
        glow: "shadow-violet-500/10",
    },
    percentage_of_daily: {
        bg: "from-blue-500/12 to-blue-500/4",
        border: "border-blue-500/20",
        text: "text-blue-400",
        dot: "bg-blue-400",
        icon: CircleDot,
        glow: "shadow-blue-500/10",
    },
}

const defaultTiers: Tier[] = [
    { name: "Grace Period", fromCount: 1, toCount: 3, deductionType: "none", deductionValue: 0, issueWarning: false, warningLevel: "verbal" },
    { name: "Warning Zone", fromCount: 4, toCount: 6, deductionType: "half_day", deductionValue: 0, issueWarning: true, warningLevel: "verbal" },
    { name: "Penalty Zone", fromCount: 7, toCount: 9, deductionType: "full_day", deductionValue: 0, issueWarning: true, warningLevel: "written" },
    { name: "Escalation", fromCount: 10, toCount: 99, deductionType: "full_day", deductionValue: 0, issueWarning: true, warningLevel: "final" },
]

// ─── Pipeline Tier Card ───────────────────────────────────────────────────────

function PipelineTierCard({
    tier,
    index,
    total,
}: {
    tier: Policy["tiers"][0] | Tier & { id?: string; tierOrder?: number }
    index: number
    total: number
}) {
    const style = tierStyles[tier.deductionType] || tierStyles.none
    const TierIcon = style.icon
    const warningInfo = warningLevels.find((w) => w.value === tier.warningLevel)
    const deductionLabel = deductionTypes.find((d) => d.value === tier.deductionType)?.shortLabel || tier.deductionType

    return (
        <div className="flex items-center gap-0">
            {/* Tier Card */}
            <div className={`relative group rounded-2xl border ${style.border} bg-linear-to-br ${style.bg} p-4 min-w-[180px] transition-all hover:scale-[1.02] hover:shadow-lg ${style.glow}`}>
                {/* Tier Number Badge */}
                <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full bg-card border-2 ${style.border} flex items-center justify-center`}>
                    <span className={`text-[10px] font-bold ${style.text}`}>{index + 1}</span>
                </div>

                {/* Icon + Name */}
                <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-lg bg-linear-to-br ${style.bg}`}>
                        <TierIcon className={`w-4 h-4 ${style.text}`} />
                    </div>
                    <h4 className="text-sm font-semibold">{tier.name}</h4>
                </div>

                {/* Late Count Range */}
                <div className="flex items-center gap-1.5 mb-2">
                    <span className={`text-xs font-mono font-bold ${style.text}`}>
                        {tier.fromCount}–{tier.toCount > 50 ? "∞" : tier.toCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        lates/month
                    </span>
                </div>

                {/* Deduction Type Badge */}
                <Badge className={`${style.border} bg-transparent ${style.text} text-[10px] gap-1`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    {deductionLabel}
                </Badge>

                {/* Warning Badge */}
                {tier.issueWarning && warningInfo && (
                    <div className="mt-2">
                        <Badge variant="outline" className="text-[9px] gap-1 bg-card/50 border-white/5 text-muted-foreground">
                            {warningInfo.emoji} {warningInfo.label}
                        </Badge>
                    </div>
                )}
            </div>

            {/* Connector Arrow */}
            {index < total - 1 && (
                <div className="flex items-center px-1 shrink-0">
                    <div className="w-5 h-px bg-linear-to-r from-white/10 to-white/5" />
                    <ChevronRight className="w-4 h-4 text-white/15 -ml-1" />
                </div>
            )}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LateDeductionPolicyPage() {
    const [policies, setPolicies] = useState<Policy[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [mounted, setMounted] = useState(false)
    const { addToast } = useToast()
    const t = useTranslations('LateDeduction')

    // Form state
    const [policyName, setPolicyName] = useState("Corporate Standard Policy")
    const [lateThreshold, setLateThreshold] = useState(10)
    const [tiers, setTiers] = useState<Tier[]>([...defaultTiers])

    useEffect(() => { setMounted(true) }, [])

    const fetchPolicies = useCallback(async () => {
        try {
            const res = await fetch("/api/policies/late-deduction")
            if (res.ok) {
                const json = await res.json()
                setPolicies(json.data || [])
            }
        } catch (error) {
            console.error("Failed to fetch policies:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchPolicies() }, [fetchPolicies])

    const addTier = () => {
        const lastTier = tiers[tiers.length - 1]
        setTiers([...tiers, {
            name: `Tier ${tiers.length + 1}`,
            fromCount: lastTier ? lastTier.toCount + 1 : 1,
            toCount: lastTier ? lastTier.toCount + 3 : 3,
            deductionType: "full_day",
            deductionValue: 0,
            issueWarning: true,
            warningLevel: "written",
        }])
    }

    const removeTier = (index: number) => {
        setTiers(tiers.filter((_, i) => i !== index))
    }

    const updateTier = (index: number, field: keyof Tier, value: string | number | boolean) => {
        const updated = [...tiers]
        updated[index] = { ...updated[index], [field]: value }
        setTiers(updated)
    }

    const handleCreate = async () => {
        if (!policyName || tiers.length === 0) {
            addToast({ title: "Please add at least one tier", type: "error" })
            return
        }
        setIsCreating(true)
        try {
            const res = await fetch("/api/policies/late-deduction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: policyName,
                    lateThresholdMinutes: lateThreshold,
                    tiers,
                }),
            })
            if (res.ok) {
                addToast({ title: "Late deduction policy created and activated", type: "success" })
                setShowCreateDialog(false)
                setPolicyName("Corporate Standard Policy")
                setLateThreshold(10)
                setTiers([...defaultTiers])
                fetchPolicies()
            } else {
                const err = await res.json()
                addToast({ title: err.error || "Failed to create policy", type: "error" })
            }
        } catch {
            addToast({ title: "Failed to create policy", type: "error" })
        } finally {
            setIsCreating(false)
        }
    }

    const activePolicy = policies.find((p) => p.isActive)
    const inactivePolicies = policies.filter((p) => !p.isActive)

    // ─── Loading Skeleton ─────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                        <Timer className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight">{t('title')}</h1>
                        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i}><CardContent className="pt-6"><div className="space-y-3 animate-pulse">
                            <div className="h-3 w-24 bg-muted rounded" />
                            <div className="h-8 w-32 bg-muted rounded" />
                            <div className="h-2 w-16 bg-muted rounded" />
                        </div></CardContent></Card>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* ── Hero Header ── */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/25">
                            <Timer className="w-6 h-6 text-white" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-400 border-2 border-background flex items-center justify-center">
                            <ShieldAlert className="w-2 h-2 text-rose-900" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight bg-linear-to-r from-rose-400 via-red-400 to-orange-400 bg-clip-text text-transparent">
                            {t('title')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2 bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-500/20 border-0">
                    <Plus className="w-4 h-4" /> {t('newPolicy')}
                </Button>
            </div>

            {/* ── Summary Stats ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Policies */}
                <Card className="relative overflow-hidden group hover:border-rose-500/20 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-rose-500/10">
                                <Layers className="w-5 h-5 text-rose-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('totalPolicies')}</p>
                        <p className="text-2xl font-display font-bold mt-1">{policies.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('totalPoliciesDesc')}</p>
                    </CardContent>
                </Card>

                {/* Active Tiers */}
                <Card className="relative overflow-hidden border-emerald-500/20">
                    <div className="absolute inset-0 bg-linear-to-br from-emerald-500/8 via-transparent to-transparent" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 shadow-lg shadow-emerald-500/10">
                                <Shield className="w-5 h-5 text-emerald-400" />
                            </div>
                            {activePolicy && (
                                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> {t('active')}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('activeTiers')}</p>
                        <p className="text-2xl font-display font-bold text-emerald-400 mt-1">
                            {activePolicy?.tiers.length || 0}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('activeTiersDesc')}</p>
                    </CardContent>
                </Card>

                {/* Late Threshold */}
                <Card className="relative overflow-hidden group hover:border-amber-500/20 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-amber-500/10">
                                <Clock className="w-5 h-5 text-amber-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('lateThreshold')}</p>
                        <p className="text-2xl font-display font-bold mt-1">
                            {activePolicy?.lateThresholdMinutes || "—"}
                            <span className="text-sm font-normal text-muted-foreground ml-1">{t('min')}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('lateThresholdDesc')}</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Active Policy Pipeline ── */}
            {activePolicy ? (
                <Card className="relative overflow-hidden border-emerald-500/15">
                    <div className="absolute inset-0 bg-linear-to-br from-emerald-500/3 via-transparent to-rose-500/3" />
                    <CardContent className="relative pt-6 pb-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-base font-semibold flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-emerald-400" />
                                    {activePolicy.name}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {t('activePolicySubtitle')} — {activePolicy.tiers.length} {t('escalationTiers')}
                                </p>
                            </div>
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
                                <CheckCircle2 className="w-3 h-3" /> {t('live')}
                            </Badge>
                        </div>

                        {/* ── Visual Pipeline ── */}
                        <div className="relative">
                            {/* Background connector line */}
                            <div className="absolute top-1/2 left-0 right-0 h-px bg-linear-to-r from-emerald-500/20 via-amber-500/20 to-red-500/20 -translate-y-1/2 z-0" />

                            {/* Tier Cards */}
                            <div className="relative z-10 flex items-center gap-0 overflow-x-auto pb-2 scrollbar-thin">
                                {activePolicy.tiers
                                    .sort((a, b) => a.tierOrder - b.tierOrder)
                                    .map((tier, i) => (
                                        <PipelineTierCard
                                            key={tier.id}
                                            tier={tier}
                                            index={i}
                                            total={activePolicy.tiers.length}
                                        />
                                    ))}
                            </div>
                        </div>

                        {/* Pipeline Legend */}
                        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-[10px] text-muted-foreground">{t('grace')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="text-[10px] text-muted-foreground">{t('halfDay')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-400" />
                                <span className="text-[10px] text-muted-foreground">{t('fullDay')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-violet-400" />
                                <span className="text-[10px] text-muted-foreground">{t('fixed')}</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1.5">
                                <Info className="w-3 h-3 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">
                                    Threshold: {activePolicy.lateThresholdMinutes}min after shift start
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                /* ── Premium Empty State ── */
                <Card className="border-dashed overflow-hidden">
                    <CardContent className="py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="relative mb-6">
                                <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-rose-500/20 to-red-500/20 flex items-center justify-center">
                                    <Timer className="w-10 h-10 text-rose-500" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-linear-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold">{t('emptyTitle')}</h3>
                            <p className="text-muted-foreground mt-2 max-w-lg leading-relaxed">
                                Without a custom policy, the system uses the <strong className="text-foreground">BLA 2006 legacy rule</strong>:
                            </p>

                            {/* Legacy Rule Visualization */}
                            <div className="mt-5 rounded-xl border border-amber-500/15 bg-linear-to-br from-amber-500/5 to-transparent p-4 max-w-md w-full">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">{t('legacyRuleTitle')}</span>
                                </div>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="text-center">
                                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-1">
                                            <span className="text-lg font-bold text-amber-400">3</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">{t('legacyLates')}</span>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                                    <div className="text-center">
                                        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-1">
                                            <span className="text-lg font-bold text-red-400">1</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">{t('legacyDayCut')}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-3">
                                    {t('legacyDescription')}
                                </p>
                            </div>

                            <Button
                                onClick={() => setShowCreateDialog(true)}
                                className="mt-6 gap-2 bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white border-0"
                            >
                                <Plus className="w-4 h-4" /> {t('createCustomPolicy')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Policy History (Inactive) ── */}
            {inactivePolicies.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {t('policyArchive')} ({inactivePolicies.length})
                        </h2>
                    </div>
                    <div className="space-y-2">
                        {inactivePolicies.map((policy) => (
                            <Card key={policy.id} className="group hover:border-white/10 transition-colors">
                                <CardContent className="py-4 px-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-500/10 flex items-center justify-center shrink-0">
                                            <Layers className="w-5 h-5 text-zinc-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-semibold truncate">{policy.name}</h3>
                                                <Badge className="bg-zinc-500/10 text-zinc-500 border-zinc-500/20 text-[10px]">
                                                    {t('inactive')}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs text-muted-foreground">
                                                    {policy.tiers.length} tiers
                                                </span>
                                                <span className="text-xs text-muted-foreground">•</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {policy.lateThresholdMinutes}min threshold
                                                </span>
                                                <span className="text-xs text-muted-foreground">•</span>
                                                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                                                    {mounted ? new Date(policy.createdAt).toLocaleDateString() : "—"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            {policy.tiers.map((tier) => {
                                                const s = tierStyles[tier.deductionType] || tierStyles.none
                                                return (
                                                    <div key={tier.id} className={`w-2.5 h-2.5 rounded-full ${s.dot} opacity-40`} title={tier.name} />
                                                )
                                            })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Create Policy Dialog (Premium Rule Builder) ── */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-[780px] max-h-[88vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-rose-500/20 to-red-500/20 flex items-center justify-center">
                                <Layers className="w-4.5 h-4.5 text-rose-400" />
                            </div>
                            {t('ruleBuilderTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('dialogDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-6 py-4 min-h-0">
                        {/* ── Basic Config ── */}
                        <div className="rounded-xl border bg-muted/20 p-4">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">{t('policyConfiguration')}</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('policyName')}</Label>
                                    <Input
                                        value={policyName}
                                        onChange={(e) => setPolicyName(e.target.value)}
                                        placeholder="e.g., Corporate Standard Policy"
                                        className="h-11"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('lateThreshold')}</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            value={lateThreshold}
                                            onChange={(e) => setLateThreshold(parseInt(e.target.value))}
                                            className="h-11 pr-12"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            min
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        {t('lateThresholdHelp')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Tier Builder ── */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-rose-400" />
                                        {t('escalationTiers')}
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {t('escalationTiersDesc')}
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" onClick={addTier} className="gap-1.5 text-xs">
                                    <Plus className="w-3.5 h-3.5" /> {t('addTier')}
                                </Button>
                            </div>

                            {/* Live Pipeline Preview */}
                            {tiers.length > 0 && (
                                <div className="flex items-center gap-0 overflow-x-auto pb-3 mb-4 px-1">
                                    {tiers.map((tier, i) => (
                                        <PipelineTierCard key={i} tier={tier} index={i} total={tiers.length} />
                                    ))}
                                </div>
                            )}

                            {/* Tier Editor Cards */}
                            <div className="space-y-3">
                                {tiers.map((tier, i) => {
                                    const style = tierStyles[tier.deductionType] || tierStyles.none
                                    return (
                                        <div key={i} className={`rounded-xl border ${style.border} p-4 space-y-3 bg-linear-to-br ${style.bg} transition-colors`}>
                                            <div className="flex items-center justify-between">
                                                <h4 className={`text-sm font-semibold flex items-center gap-2 ${style.text}`}>
                                                    <Zap className="w-4 h-4" />
                                                    Tier {i + 1}: {tier.name || t('untitled')}
                                                </h4>
                                                {tiers.length > 1 && (
                                                    <Button size="sm" variant="ghost" onClick={() => removeTier(i)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-4 gap-3">
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t('tierName')}</Label>
                                                    <Input
                                                        value={tier.name}
                                                        onChange={(e) => updateTier(i, "name", e.target.value)}
                                                        className="h-9 text-sm bg-card/50"
                                                    />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t('fromLate')}</Label>
                                                    <Input
                                                        type="number"
                                                        value={tier.fromCount}
                                                        onChange={(e) => updateTier(i, "fromCount", parseInt(e.target.value))}
                                                        className="h-9 text-sm bg-card/50"
                                                    />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t('toLate')}</Label>
                                                    <Input
                                                        type="number"
                                                        value={tier.toCount}
                                                        onChange={(e) => updateTier(i, "toCount", parseInt(e.target.value))}
                                                        className="h-9 text-sm bg-card/50"
                                                    />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t('deduction')}</Label>
                                                    <Select value={tier.deductionType} onValueChange={(v) => updateTier(i, "deductionType", v)}>
                                                        <SelectTrigger className="h-9 text-xs bg-card/50"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {deductionTypes.map((dt) => (
                                                                <SelectItem key={dt.value} value={dt.value} className="text-xs">{dt.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {(tier.deductionType === "fixed_amount" || tier.deductionType === "percentage_of_daily") && (
                                                <div className="grid gap-1.5 max-w-[200px]">
                                                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                                        {tier.deductionType === "fixed_amount" ? t('amountBDT') : t('percentage')}
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={tier.deductionValue}
                                                        onChange={(e) => updateTier(i, "deductionValue", parseFloat(e.target.value))}
                                                        className="h-9 text-sm bg-card/50"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between pt-1 border-t border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={tier.issueWarning}
                                                        onCheckedChange={(v) => updateTier(i, "issueWarning", v)}
                                                    />
                                                    <Label className="text-xs">{t('issueWarning')}</Label>
                                                </div>
                                                {tier.issueWarning && (
                                                    <Select value={tier.warningLevel} onValueChange={(v) => updateTier(i, "warningLevel", v)}>
                                                        <SelectTrigger className="h-8 w-[170px] text-xs bg-card/50"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {warningLevels.map((wl) => (
                                                                <SelectItem key={wl.value} value={wl.value} className="text-xs">
                                                                    {wl.emoji} {wl.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('cancel')}</Button>
                        <Button
                            onClick={handleCreate}
                            disabled={isCreating || !policyName || tiers.length === 0}
                            className="gap-2 bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white border-0 min-w-[160px]"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('creating')}
                                </>
                            ) : (
                                <>
                                    <Shield className="w-4 h-4" />
                                    {t('createAndActivate')}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
