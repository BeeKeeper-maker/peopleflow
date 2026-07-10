"use client"

import { useState, useEffect, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
    Shield,
    Plus,
    Loader2,

    CheckCircle2,
    XCircle,
    Search,
    ShieldCheck,
    KeyRound,
    Lock,
    Eye,
    FileCheck,
    Wallet,
    ClipboardList,
    Clock,
    CalendarRange,
    ChevronRight,

    ShieldAlert,
    Fingerprint,
    UserCheck,
    ArrowDownRight,
    ArrowUpRight,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"
import { useDelegations, useEmployees, queryKeys } from "@/hooks/use-data"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Delegation {
    id: string
    permission: string
    scope: string
    departmentIds: string[] | null
    validFrom: string
    validUntil: string | null
    isActive: boolean
    createdAt: string
    user?: { name: string; email: string }
}

interface Employee {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    designation?: { name: string }
    department?: { name: string }
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Dynamic today — computed on client side after hydration to avoid mismatch.
// getStatus() already uses new Date() which is correct; this is only for
// default form values where we need a date string.
function getTodayISO(): string {
    return new Date().toISOString().split("T")[0];
}

const permissionOptions = [
    { value: "approval:act", label: "Approval Authority", desc: "Leave, Expense, Loan", icon: FileCheck, color: "text-indigo-400" },
    { value: "leave:approve", label: "Leave Approval", desc: "Approve leave requests", icon: ClipboardList, color: "text-emerald-400" },
    { value: "expense:approve", label: "Expense Approval", desc: "Approve expense claims", icon: Wallet, color: "text-amber-400" },
    { value: "attendance:manage", label: "Attendance Mgmt", desc: "Manage attendance records", icon: Clock, color: "text-blue-400" },
    { value: "employees:view", label: "Directory Access", desc: "View employee directory", icon: Eye, color: "text-violet-400" },
]

const scopeOptions = [
    { value: "global", label: "Global", desc: "All Departments", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" },
    { value: "department", label: "Department", desc: "Specific Dept Only", color: "bg-teal-500/15 text-teal-400 border-teal-500/20" },
    { value: "branch", label: "Branch", desc: "Branch Scoped", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
]

// ─── Status helpers ───────────────────────────────────────────────────────────

function getStatus(d: Delegation): "active" | "expired" | "upcoming" | "revoked" {
    if (!d.isActive) return "revoked"
    if (d.validUntil && new Date(d.validUntil) < new Date()) return "expired"
    if (new Date(d.validFrom) > new Date()) return "upcoming"
    return "active"
}

const statusStyles = {
    active: { label: "Active", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400", pulse: true },
    expired: { label: "Expired", color: "bg-red-500/15 text-red-400 border-red-500/20", dot: "bg-red-400", pulse: false },
    upcoming: { label: "Upcoming", color: "bg-amber-500/15 text-amber-400 border-amber-500/20", dot: "bg-amber-400", pulse: true },
    revoked: { label: "Revoked", color: "bg-zinc-500/15 text-zinc-500 border-zinc-500/20", dot: "bg-zinc-500", pulse: false },
}

function getPermissionLabel(perm: string) {
    return permissionOptions.find((p) => p.value === perm)?.label || perm.replace(/[_:]/g, " ")
}

function getPermissionIcon(perm: string) {
    return permissionOptions.find((p) => p.value === perm)?.icon || Shield
}

function getScopeStyle(scope: string) {
    return scopeOptions.find((s) => s.value === scope)?.color || "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"
}

// ─── Delegation Row Card ──────────────────────────────────────────────────────

function DelegationCard({
    delegation,
    direction,
    onRevoke,
    mounted,
}: {
    delegation: Delegation
    direction: "outgoing" | "incoming"
    onRevoke?: (id: string) => void
    mounted: boolean
}) {
    const t = useTranslations('Delegations')
    const status = getStatus(delegation)
    const style = statusStyles[status]
    const PermIcon = getPermissionIcon(delegation.permission)
    const isLive = status === "active"

    return (
        <Card className={`group overflow-hidden transition-all border ${isLive ? "border-indigo-500/15 hover:border-indigo-500/25" : "hover:border-white/10"}`}>
            <CardContent className="p-0">
                <div className="flex items-center gap-4 px-5 py-4">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isLive ? "bg-linear-to-br from-indigo-500/20 to-violet-500/20" : "bg-muted/50"}`}>
                            <span className={`text-xs font-bold ${isLive ? "text-indigo-400" : "text-muted-foreground"}`}>
                                {delegation.user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "??"}
                            </span>
                        </div>
                        {isLive && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold truncate">{delegation.user?.name || "Unknown"}</h3>
                            <Badge className={`${style.color} text-[10px] gap-1`}>
                                {style.pulse && <div className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === "active" ? "animate-pulse" : ""}`} />}
                                {style.label}
                            </Badge>
                            {direction === "outgoing" && (
                                <ArrowUpRight className="w-3 h-3 text-indigo-400/50" />
                            )}
                            {direction === "incoming" && (
                                <ArrowDownRight className="w-3 h-3 text-violet-400/50" />
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{delegation.user?.email || ""}</p>
                    </div>

                    {/* Permission Badge */}
                    <div className="shrink-0">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/5 bg-muted/30">
                            <PermIcon className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-xs font-medium">{getPermissionLabel(delegation.permission)}</span>
                        </div>
                    </div>

                    {/* Scope */}
                    <div className="shrink-0">
                        <Badge className={`text-[10px] ${getScopeStyle(delegation.scope)}`}>
                            {delegation.scope}
                        </Badge>
                    </div>

                    {/* Date Range */}
                    <div className="text-right shrink-0 min-w-[120px]">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" suppressHydrationWarning>
                            <CalendarRange className="w-3 h-3" />
                            {mounted ? (
                                <span>
                                    {new Date(delegation.validFrom).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                    {" → "}
                                    {delegation.validUntil ? new Date(delegation.validUntil).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "∞"}
                                </span>
                            ) : (
                                <span>—</span>
                            )}
                        </div>
                    </div>

                    {/* Revoke Action */}
                    <div className="shrink-0 w-[80px] flex justify-end">
                        {direction === "outgoing" && isLive && onRevoke && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onRevoke(delegation.id)}
                                className="gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2.5"
                            >
                                <XCircle className="w-3.5 h-3.5" />
                                <span className="text-xs">{t('revoke')}</span>
                            </Button>
                        )}
                        {direction === "outgoing" && !isLive && (
                            <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center">
                                <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                            </div>
                        )}
                        {direction === "incoming" && (
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                <ChevronRight className="w-4 h-4 text-indigo-400/40" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Progress/Status Bar */}
                {isLive && delegation.validUntil && (
                    <div className="h-0.5 bg-muted">
                        <div
                            className="h-full bg-linear-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                            style={{
                                width: (() => {
                                    const start = new Date(delegation.validFrom).getTime()
                                    const end = new Date(delegation.validUntil!).getTime()
                                    const now = Date.now()
                                    const pct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100))
                                    return `${pct}%`
                                })(),
                            }}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DelegationsPage() {
    const queryClient = useQueryClient()
    const { data: delegationsData, isLoading: isLoading } = useDelegations()
    const delegated = useMemo<Delegation[]>(() => (delegationsData?.delegated ?? []) as unknown as Delegation[], [delegationsData])
    const received = useMemo<Delegation[]>(() => (delegationsData?.received ?? []) as unknown as Delegation[], [delegationsData])
    const { data: employeesResp } = useEmployees({ limit: 500 })
    const employees = useMemo<Employee[]>(() => (employeesResp?.data ?? []) as unknown as Employee[], [employeesResp])
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [employeeSearch, setEmployeeSearch] = useState("")
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
    const [mounted, setMounted] = useState(false)
    const { addToast } = useToast()
    const t = useTranslations('Delegations')

    // Form state
    const [formData, setFormData] = useState({
        targetEmployeeId: "",
        permission: "approval:act",
        scope: "global",
        validFrom: getTodayISO(),
        validUntil: "",
        reason: "",
    })

    useEffect(() => { setMounted(true) }, [])

    const invalidateDelegations = () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.rbac.delegations() })
    }

    const handleCreate = async () => {
        if (!formData.targetEmployeeId || !formData.validUntil) {
            addToast({ title: "Please select an employee and set expiry date", type: "error" })
            return
        }
        setIsCreating(true)
        try {
            const res = await fetch("/api/rbac/delegations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })
            if (res.ok) {
                addToast({ title: "Delegation created successfully", type: "success" })
                setShowCreateDialog(false)
                setFormData({
                    targetEmployeeId: "", permission: "approval:act", scope: "global",
                    validFrom: getTodayISO(), validUntil: "", reason: "",
                })
                setEmployeeSearch("")
                invalidateDelegations()
            } else {
                const err = await res.json()
                addToast({ title: err.error || "Failed to create delegation", type: "error" })
            }
        } catch {
            addToast({ title: "Failed to create delegation", type: "error" })
        } finally {
            setIsCreating(false)
        }
    }

    const handleRevoke = async (id: string) => {
        try {
            const res = await fetch(`/api/rbac/delegations?id=${id}`, { method: "DELETE" })
            if (res.ok) {
                addToast({ title: "Delegation revoked successfully", type: "success" })
                invalidateDelegations()
            } else {
                addToast({ title: "Failed to revoke", type: "error" })
            }
        } catch {
            addToast({ title: "Failed to revoke delegation", type: "error" })
        }
    }

    const activeDelegations = useMemo(() => delegated.filter((d) => getStatus(d) === "active"), [delegated])
    const activeReceived = useMemo(() => received.filter((d) => getStatus(d) === "active"), [received])

    const filteredEmployees = useMemo(() =>
        employees.filter(
            (e) =>
                `${e.firstName} ${e.lastName}`.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                e.employeeCode.toLowerCase().includes(employeeSearch.toLowerCase())
        ), [employees, employeeSearch])

    const selectedEmployee = useMemo(
        () => employees.find((e) => e.id === formData.targetEmployeeId),
        [employees, formData.targetEmployeeId]
    )

    // ─── Loading Skeleton ─────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Fingerprint className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight">{t('title')}</h1>
                        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}><CardContent className="pt-6"><div className="space-y-3 animate-pulse">
                            <div className="h-3 w-24 bg-muted rounded" />
                            <div className="h-8 w-16 bg-muted rounded" />
                            <div className="h-2 w-20 bg-muted rounded" />
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
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <Fingerprint className="w-6 h-6 text-white" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-indigo-400 border-2 border-background flex items-center justify-center">
                            <Lock className="w-2 h-2 text-indigo-900" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight bg-linear-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                            {t('title')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20 border-0">
                    <Plus className="w-4 h-4" /> {t('delegateAuthority')}
                </Button>
            </div>

            {/* ── Premium Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Delegated */}
                <Card className="relative overflow-hidden group hover:border-indigo-500/20 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-indigo-500/10">
                                <ArrowUpRight className="w-5 h-5 text-indigo-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('delegated')}</p>
                        <p className="text-2xl font-display font-bold mt-1 tabular-nums">{delegated.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('delegatedDesc')}</p>
                    </CardContent>
                </Card>

                {/* Active Now */}
                <Card className="relative overflow-hidden border-emerald-500/20">
                    <div className="absolute inset-0 bg-linear-to-br from-emerald-500/8 via-transparent to-transparent" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 shadow-lg shadow-emerald-500/10">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            </div>
                            {activeDelegations.length > 0 && (
                                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px] gap-1 animate-pulse">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('activeNow')}</p>
                        <p className="text-2xl font-display font-bold text-emerald-400 mt-1 tabular-nums">{activeDelegations.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('activeNowDesc')}</p>
                    </CardContent>
                </Card>

                {/* Received */}
                <Card className="relative overflow-hidden group hover:border-violet-500/20 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-violet-500/10">
                                <ArrowDownRight className="w-5 h-5 text-violet-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('received')}</p>
                        <p className="text-2xl font-display font-bold mt-1 tabular-nums">{received.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('receivedDesc')}</p>
                    </CardContent>
                </Card>

                {/* Security Score */}
                <Card className="relative overflow-hidden group hover:border-blue-500/20 transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="relative pt-6 pb-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-blue-500/10">
                                <Shield className="w-5 h-5 text-blue-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('permissions')}</p>
                        <p className="text-2xl font-display font-bold mt-1 tabular-nums">{activeReceived.length + activeDelegations.length}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{t('permissionsDesc')}</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Delegated by You ── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-indigo-400" />
                            {t('delegatedByYou')}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t('delegatedByYouDesc')}
                        </p>
                    </div>
                </div>

                {delegated.length === 0 ? (
                    <Card className="border-dashed overflow-hidden">
                        <CardContent className="py-16">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="relative mb-6">
                                    <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                                        <Fingerprint className="w-10 h-10 text-indigo-500" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                                        <KeyRound className="w-4 h-4 text-emerald-500" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-semibold">{t('emptyTitle')}</h3>
                                <p className="text-muted-foreground mt-2 max-w-md leading-relaxed">
                                    {t('emptyDescription')}
                                </p>

                                {/* Security Note */}
                                <div className="mt-5 rounded-xl border border-indigo-500/15 bg-linear-to-br from-indigo-500/5 to-transparent p-4 max-w-md w-full">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShieldAlert className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">{t('securityNote')}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mx-auto mb-1">
                                                <CalendarRange className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">{t('timeBounded')}</span>
                                        </div>
                                        <div>
                                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto mb-1">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">{t('autoExpiry')}</span>
                                        </div>
                                        <div>
                                            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mx-auto mb-1">
                                                <ClipboardList className="w-5 h-5 text-violet-400" />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">{t('auditLogged')}</span>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => setShowCreateDialog(true)}
                                    className="mt-6 gap-2 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0"
                                >
                                    <Plus className="w-4 h-4" /> {t('delegateAuthority')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {delegated.map((d) => (
                            <DelegationCard
                                key={d.id}
                                delegation={d}
                                direction="outgoing"
                                onRevoke={handleRevoke}
                                mounted={mounted}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Received by You ── */}
            {received.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-base font-semibold flex items-center gap-2">
                                <ArrowDownRight className="w-4 h-4 text-violet-400" />
                                {t('delegatedToYou')}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {t('delegatedToYouDesc')}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {received.map((d) => (
                            <DelegationCard
                                key={d.id}
                                delegation={d}
                                direction="incoming"
                                mounted={mounted}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Create Delegation Dialog (Premium) ── */}
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
                setShowCreateDialog(open)
                if (!open) {
                    setEmployeeSearch("")
                    setShowEmployeeDropdown(false)
                }
            }}>
                <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                                <ShieldCheck className="w-4.5 h-4.5 text-indigo-400" />
                            </div>
                            {t('delegateAuthority')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('dialogDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-5 py-4 min-h-0 pr-1">
                        {/* ── Employee Selector ── */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('delegateTo')}</Label>
                            {selectedEmployee ? (
                                <div className="flex items-center gap-3 p-3 rounded-xl border bg-indigo-500/5 border-indigo-500/15">
                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                                        <UserCheck className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {selectedEmployee.employeeCode} • {selectedEmployee.designation?.name || "N/A"}
                                        </p>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => {
                                        setFormData({ ...formData, targetEmployeeId: "" })
                                        setEmployeeSearch("")
                                    }} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                                        {t('change')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name or ID..."
                                        className="pl-9 h-11"
                                        value={employeeSearch}
                                        onChange={(e) => {
                                            setEmployeeSearch(e.target.value)
                                            setShowEmployeeDropdown(true)
                                        }}
                                        onFocus={() => setShowEmployeeDropdown(true)}
                                    />
                                    {showEmployeeDropdown && employeeSearch && (
                                        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border bg-card shadow-xl divide-y divide-white/5">
                                            {filteredEmployees.length === 0 ? (
                                                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                    {t('noEmployeesFound')}
                                                </div>
                                            ) : (
                                                filteredEmployees.slice(0, 8).map((emp) => (
                                                    <button
                                                        key={emp.id}
                                                        className="w-full text-left px-4 py-3 hover:bg-indigo-500/5 transition-colors flex items-center gap-3"
                                                        onClick={() => {
                                                            setFormData({ ...formData, targetEmployeeId: emp.id })
                                                            setEmployeeSearch(`${emp.firstName} ${emp.lastName}`)
                                                            setShowEmployeeDropdown(false)
                                                        }}
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                                            <span className="text-[10px] font-bold text-muted-foreground">
                                                                {emp.firstName[0]}{emp.lastName[0]}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{emp.firstName} {emp.lastName}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {emp.employeeCode} • {emp.designation?.name || emp.department?.name || ""}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Permission Selector (Card Grid) ── */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('permissionScope')}</Label>
                            <div className="grid grid-cols-1 gap-2">
                                {permissionOptions.map((perm) => {
                                    const isSelected = formData.permission === perm.value
                                    const PermIcon = perm.icon
                                    return (
                                        <button
                                            key={perm.value}
                                            onClick={() => setFormData({ ...formData, permission: perm.value })}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                                                isSelected
                                                    ? "border-indigo-500/30 bg-indigo-500/8 ring-1 ring-indigo-500/20"
                                                    : "border-white/5 bg-muted/20 hover:bg-muted/40"
                                            }`}
                                        >
                                            <div className={`p-2 rounded-lg ${isSelected ? "bg-indigo-500/15" : "bg-muted/30"}`}>
                                                <PermIcon className={`w-4 h-4 ${isSelected ? perm.color : "text-muted-foreground"}`} />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                                                    {perm.label}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">{perm.desc}</p>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* ── Scope ── */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('accessScope')}</Label>
                            <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v })}>
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {scopeOptions.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            <span className="flex items-center gap-2">
                                                <span>{s.label}</span>
                                                <span className="text-[10px] text-muted-foreground">— {s.desc}</span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* ── Date Range ── */}
                        <div className="rounded-xl border bg-muted/20 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <CalendarRange className="w-4 h-4 text-indigo-400" />
                                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('delegationPeriod')}</Label>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-1.5">
                                    <Label className="text-[10px] text-muted-foreground">{t('validFrom')}</Label>
                                    <Input
                                        type="date"
                                        value={formData.validFrom}
                                        onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                                        className="h-10"
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-[10px] text-muted-foreground">{t('validUntil')}</Label>
                                    <Input
                                        type="date"
                                        value={formData.validUntil}
                                        onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                        className="h-10"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Reason ── */}
                        <div className="grid gap-2">
                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('reason')}</Label>
                            <Input
                                placeholder="e.g., On annual leave from March 15-30"
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                className="h-11"
                            />
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t('cancel')}</Button>
                        <Button
                            onClick={handleCreate}
                            disabled={isCreating || !formData.targetEmployeeId || !formData.validUntil}
                            className="gap-2 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0 min-w-[170px]"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('creating')}
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="w-4 h-4" />
                                    {t('createDelegation')}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
