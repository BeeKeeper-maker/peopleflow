"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Plus,
    Loader2,
    HandCoins,
    Trash2,
    Check,
    X,
    Banknote,
    Search,
    TrendingUp,
    DollarSign,
    Clock,
    CheckCircle2,
    Wallet,
    ArrowUpRight,
    CreditCard,
    MoreHorizontal,
    FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

interface Employee {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
}

interface Loan {
    id: string
    type: string
    amount: number
    interestRate: number
    tenure: number
    emiAmount: number
    disbursedAmount: number
    paidAmount: number
    remainingAmount: number
    status: string
    reason?: string | null
    createdAt: string
    employee: Employee
}

const LOAN_TYPES = [
    { value: "salary_advance", label: "Salary Advance", icon: "💰" },
    { value: "personal", label: "Personal Loan", icon: "🏦" },
    { value: "emergency", label: "Emergency Loan", icon: "🚨" },
    { value: "housing", label: "Housing Loan", icon: "🏠" },
    { value: "education", label: "Education Loan", icon: "🎓" },
]

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
    pending: { color: "text-amber-400", bgColor: "bg-amber-500/15", icon: Clock },
    approved: { color: "text-blue-400", bgColor: "bg-blue-500/15", icon: CheckCircle2 },
    rejected: { color: "text-red-400", bgColor: "bg-red-500/15", icon: X },
    disbursed: { color: "text-emerald-400", bgColor: "bg-emerald-500/15", icon: Wallet },
    closed: { color: "text-slate-400", bgColor: "bg-slate-500/15", icon: Check },
}

// ════════════════════════════════════════════════════════════════════════
// Animated Counter
// ════════════════════════════════════════════════════════════════════════

function AnimatedCounter({ target, prefix = "", duration = 1200 }: {
    target: number; prefix?: string; duration?: number
}) {
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
    return <>{prefix}{count.toLocaleString()}</>
}

// ════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════

export default function LoansPage() {
    const t = useTranslations('Loans')
    const { addToast } = useToast()
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [loans, setLoans] = useState<Loan[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    const [form, setForm] = useState({
        employeeId: "", type: "salary_advance", amount: "", interestRate: "0", tenure: "12", reason: ""
    })

    const fetchData = useCallback(async () => {
        try {
            const [loansRes, empRes] = await Promise.all([
                fetch("/api/loans"),
                fetch("/api/employees?fields=id,firstName,lastName,employeeId"),
            ])
            if (loansRes.ok) setLoans(await loansRes.json())
            if (empRes.ok) {
                const empData = await empRes.json()
                setEmployees(Array.isArray(empData) ? empData : empData.data || empData.employees || [])
            }
        } catch (error) {
            console.error("Failed to fetch", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // ── Actions ────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!form.employeeId || !form.amount || !form.tenure) return
        setSaving(true)
        try {
            const res = await fetch("/api/loans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: form.employeeId,
                    type: form.type,
                    amount: parseFloat(form.amount),
                    interestRate: parseFloat(form.interestRate || "0"),
                    tenure: parseInt(form.tenure),
                    reason: form.reason || null,
                }),
            })
            if (res.ok) {
                addToast({ title: t('created'), type: "success" })
                setShowForm(false)
                setForm({ employeeId: "", type: "salary_advance", amount: "", interestRate: "0", tenure: "12", reason: "" })
                fetchData()
            } else {
                const err = await res.json()
                addToast({ title: err.error || t('createFailed'), type: "error" })
            }
        } catch { addToast({ title: t('createFailed'), type: "error" }) }
        finally { setSaving(false) }
    }

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            const res = await fetch(`/api/loans/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            if (res.ok) {
                addToast({ title: t('statusUpdated'), type: "success" })
                fetchData()
            }
        } catch { addToast({ title: t('updateFailed'), type: "error" }) }
    }

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: t('confirmDelete'),
            description: "This action cannot be undone.",
            confirmLabel: "Delete",
            variant: "destructive",
        })
        if (!ok) return
        try {
            const res = await fetch(`/api/loans/${id}`, { method: "DELETE" })
            if (res.ok) fetchData()
        } catch { /* silent */ }
    }

    const formatCurrency = (amount: number) => `৳${amount.toLocaleString()}`

    // ── Computed Stats ──────────────────────────────────────────────
    const stats = useMemo(() => {
        const totalDisbursed = loans.filter(l => l.status === "disbursed").reduce((s, l) => s + l.amount, 0)
        const totalOutstanding = loans.filter(l => l.status === "disbursed").reduce((s, l) => s + l.remainingAmount, 0)
        const totalRecovered = loans.filter(l => l.status === "disbursed").reduce((s, l) => s + l.paidAmount, 0)
        const pending = loans.filter(l => l.status === "pending").length
        const activeLoans = loans.filter(l => l.status === "disbursed").length

        return { totalDisbursed, totalOutstanding, totalRecovered, pending, activeLoans }
    }, [loans])

    // ── Filtered + Searched ─────────────────────────────────────────
    const filteredLoans = useMemo(() => {
        let result = loans
        if (statusFilter !== "all") {
            result = result.filter(l => l.status === statusFilter)
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(l =>
                `${l.employee.firstName} ${l.employee.lastName}`.toLowerCase().includes(q) ||
                l.employee.employeeCode.toLowerCase().includes(q) ||
                l.type.toLowerCase().includes(q)
            )
        }
        return result
    }, [loans, statusFilter, searchQuery])

    // ════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════

    return (
        <div className="space-y-6">
            {/* ── Hero Header ──────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                        <HandCoins className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">{t('title')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('subtitle')}
                            {!isLoading && (
                                <Badge variant="default" className="ml-2">{loans.length} {t('totalLoans') || "total"}</Badge>
                            )}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => setShowForm(true)}
                    className="gap-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
                >
                    <Plus className="h-4 w-4" />
                    {t('createLoan')}
                </Button>
            </div>

            {/* ── Stats Row ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-5">
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-8 w-20" />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    [
                        {
                            label: t('totalDisbursed') || "Total Disbursed",
                            value: stats.totalDisbursed,
                            Icon: DollarSign,
                            color: "from-emerald-500 to-emerald-600",
                            glow: "bg-emerald-500",
                            prefix: "৳",
                        },
                        {
                            label: t('outstanding') || "Outstanding",
                            value: stats.totalOutstanding,
                            Icon: CreditCard,
                            color: "from-amber-500 to-amber-600",
                            glow: "bg-amber-500",
                            prefix: "৳",
                        },
                        {
                            label: t('recovered') || "Recovered",
                            value: stats.totalRecovered,
                            Icon: TrendingUp,
                            color: "from-blue-500 to-blue-600",
                            glow: "bg-blue-500",
                            prefix: "৳",
                        },
                        {
                            label: t('pendingApproval') || "Pending Approval",
                            value: stats.pending,
                            Icon: Clock,
                            color: "from-purple-500 to-purple-600",
                            glow: "bg-purple-500",
                            badge: stats.pending > 0 ? "Action Required" : undefined,
                        },
                    ].map((card) => (
                        <Card key={card.label} className="relative overflow-hidden group hover:border-border transition-all duration-300 hover:-translate-y-0.5">
                            <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full ${card.glow} opacity-20 blur-3xl group-hover:opacity-40 transition-opacity duration-500`} />
                            <CardContent className="p-5 relative">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                                        <p className="text-2xl font-display font-bold text-foreground tabular-nums">
                                            <AnimatedCounter target={card.value} prefix={card.prefix || ""} />
                                        </p>
                                        {card.badge && (
                                            <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">{card.badge}</Badge>
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

            {/* ── Search & Filter Bar ──────────────────────────────── */}
            {!isLoading && loans.length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('searchPlaceholder') || "Search by employee name or code..."}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-hover border-card-border"
                                />
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                                {["all", "pending", "approved", "disbursed", "closed"].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setStatusFilter(status)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                            statusFilter === status
                                                ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                                                : "bg-hover text-muted-foreground hover:text-foreground hover:bg-card"
                                        )}
                                    >
                                        {status === "all" ? (t('allFilter') || "All") : status.charAt(0).toUpperCase() + status.slice(1)}
                                        {status !== "all" && (
                                            <span className="ml-1 text-[10px] opacity-60">
                                                ({loans.filter(l => l.status === status).length})
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Empty State ──────────────────────────────────────── */}
            {!isLoading && loans.length === 0 && (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-20">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 mb-5">
                            <HandCoins className="h-8 w-8 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">{t('noLoans')}</h3>
                        <p className="text-sm text-muted-foreground mt-2 mb-6 text-center max-w-sm">{t('noLoansDesc')}</p>
                        <Button onClick={() => setShowForm(true)} className="gap-2 bg-linear-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/25">
                            <Plus className="h-4 w-4" />
                            {t('createLoan')}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ── Loan Cards Grid ──────────────────────────────────── */}
            {!isLoading && filteredLoans.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredLoans.map(loan => {
                        const typeObj = LOAN_TYPES.find(lt => lt.value === loan.type)
                        const statusCfg = STATUS_CONFIG[loan.status] || STATUS_CONFIG.pending
                        const StatusIcon = statusCfg.icon
                        const progress = loan.amount > 0 ? Math.round((loan.paidAmount / loan.amount) * 100) : 0

                        return (
                            <Card key={loan.id} className="group hover:border-border hover:-translate-y-0.5 transition-all duration-300">
                                <CardContent className="p-5">
                                    {/* Top: Employee + Status */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 ring-2 ring-card-border">
                                                <AvatarFallback className="text-xs bg-linear-to-br from-blue-500/20 to-purple-500/20 text-foreground">
                                                    {loan.employee.firstName[0]}{loan.employee.lastName[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">
                                                    {loan.employee.firstName} {loan.employee.lastName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{loan.employee.employeeCode}</p>
                                            </div>
                                        </div>
                                        <Badge className={cn("text-[10px] gap-1", statusCfg.bgColor, statusCfg.color)}>
                                            <StatusIcon className="h-3 w-3" />
                                            {loan.status}
                                        </Badge>
                                    </div>

                                    {/* Loan Type + Amount */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{typeObj?.icon || "💰"}</span>
                                            <span className="text-xs font-medium text-muted-foreground">{typeObj?.label || loan.type}</span>
                                        </div>
                                        <p className="text-xl font-display font-bold text-foreground tabular-nums">{formatCurrency(loan.amount)}</p>
                                    </div>

                                    {/* Progress Bar (for disbursed loans) */}
                                    {loan.status === "disbursed" && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Repayment Progress</span>
                                                <span className="text-xs font-bold tabular-nums text-foreground">{progress}%</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-hover overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1.5">
                                                <span className="text-[10px] text-emerald-400">Paid: {formatCurrency(loan.paidAmount)}</span>
                                                <span className="text-[10px] text-amber-400">Remaining: {formatCurrency(loan.remainingAmount)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-3 gap-3 py-3 border-t border-card-border">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase">EMI</p>
                                            <p className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(loan.emiAmount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase">Tenure</p>
                                            <p className="text-xs font-semibold text-foreground">{loan.tenure} months</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase">Rate</p>
                                            <p className="text-xs font-semibold text-foreground">{loan.interestRate}%</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-card-border">
                                        {loan.status === "pending" && (
                                            <>
                                                <Button
                                                    size="sm" variant="outline"
                                                    onClick={() => handleStatusUpdate(loan.id, "approved")}
                                                    className="flex-1 h-8 text-xs gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    {t('approve') || "Approve"}
                                                </Button>
                                                <Button
                                                    size="sm" variant="outline"
                                                    onClick={() => handleStatusUpdate(loan.id, "rejected")}
                                                    className="flex-1 h-8 text-xs gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    {t('reject') || "Reject"}
                                                </Button>
                                            </>
                                        )}
                                        {loan.status === "approved" && (
                                            <Button
                                                size="sm" variant="outline"
                                                onClick={() => handleStatusUpdate(loan.id, "disbursed")}
                                                className="flex-1 h-8 text-xs gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50"
                                            >
                                                <Banknote className="h-3.5 w-3.5" />
                                                {t('disburse')}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm" variant="ghost"
                                            onClick={() => handleDelete(loan.id)}
                                            className="h-8 w-8 p-0 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* ── Create Modal ─────────────────────────────────────── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-md">
                    <div className="w-full max-w-lg mx-4 rounded-2xl border border-card-border bg-card-bg p-6 shadow-2xl shadow-black/40 animate-in fade-in-0 zoom-in-95">
                        {/* Modal Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600">
                                <HandCoins className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">{t('createLoan')}</h2>
                                <p className="text-xs text-muted-foreground">{t('createLoanDesc') || "Set up a new employee loan"}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('employee')}</Label>
                                <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
                                    className="w-full mt-1.5 rounded-xl border border-card-border bg-hover px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all">
                                    <option value="">{t('selectEmployee')}</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('loanType')}</Label>
                                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                                        className="w-full mt-1.5 rounded-xl border border-card-border bg-hover px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all">
                                        {LOAN_TYPES.map(lt => (
                                            <option key={lt.value} value={lt.value}>{lt.icon} {lt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('amount')}</Label>
                                    <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                                        placeholder="৳ 50,000"
                                        className="mt-1.5 bg-hover border-card-border rounded-xl" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('interestRate')}</Label>
                                    <Input type="number" value={form.interestRate} onChange={e => setForm(p => ({ ...p, interestRate: e.target.value }))}
                                        step="0.5" min="0"
                                        className="mt-1.5 bg-hover border-card-border rounded-xl" />
                                </div>
                                <div>
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('tenure')}</Label>
                                    <Input type="number" value={form.tenure} onChange={e => setForm(p => ({ ...p, tenure: e.target.value }))}
                                        min="1" placeholder="12 months"
                                        className="mt-1.5 bg-hover border-card-border rounded-xl" />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('reason')}</Label>
                                <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                                    placeholder={t('reasonPlaceholder')} rows={2}
                                    className="w-full mt-1.5 rounded-xl border border-card-border bg-hover px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-card-border">
                            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">{t('cancel')}</Button>
                            <Button onClick={handleCreate} disabled={saving}
                                className="gap-2 bg-linear-to-r from-emerald-600 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
                                {t('save')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {confirmDialog}
        </div>
    )
}
