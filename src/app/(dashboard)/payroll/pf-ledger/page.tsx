"use client"

import Link from "next/link"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
    Landmark,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    DollarSign,
    Search,
    Users,
    Wallet,
    PiggyBank,
    Shield,
    Calendar,
    Percent,
    Activity,
    Filter,
    Sparkles,
    Download,
} from "lucide-react"
import { useTranslations } from "next-intl"
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    CartesianGrid,
} from "recharts"

// ─── Types ───────────────────────────────────────────────────────────────────

interface PFSummary {
    accountId: string
    accountNumber: string | null
    status: string
    employeeBalance: number
    employerBalance: number
    interestBalance: number
    totalBalance: number
    openingDate: string
    interestRate: number
    lastInterestDate: string | null
    transactionCount: number
}

interface PFTransaction {
    id: string
    transactionType: string
    amount: number
    runningBalance: number
    description: string
    transactionDate: string
}

interface Employee {
    id: string
    name: string
    code: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const txTypeConfig: Record<string, {
    icon: typeof TrendingUp
    label: string
    gradient: string
    dotColor: string
    textColor: string
}> = {
    employee_contribution: {
        icon: ArrowUpRight,
        label: "Employee Contribution",
        gradient: "from-emerald-500/20 to-emerald-500/5",
        dotColor: "bg-emerald-500",
        textColor: "text-emerald-400",
    },
    employer_contribution: {
        icon: ArrowUpRight,
        label: "Employer Contribution",
        gradient: "from-blue-500/20 to-blue-500/5",
        dotColor: "bg-blue-500",
        textColor: "text-blue-400",
    },
    interest_credit: {
        icon: Sparkles,
        label: "Interest Credit",
        gradient: "from-amber-500/20 to-amber-500/5",
        dotColor: "bg-amber-500",
        textColor: "text-amber-400",
    },
    withdrawal: {
        icon: ArrowDownRight,
        label: "Withdrawal",
        gradient: "from-red-500/20 to-red-500/5",
        dotColor: "bg-red-500",
        textColor: "text-red-400",
    },
    settlement: {
        icon: TrendingDown,
        label: "Settlement",
        gradient: "from-rose-500/20 to-rose-500/5",
        dotColor: "bg-rose-500",
        textColor: "text-rose-400",
    },
    adjustment: {
        icon: Activity,
        label: "Adjustment",
        gradient: "from-zinc-500/20 to-zinc-500/5",
        dotColor: "bg-zinc-500",
        textColor: "text-zinc-400",
    },
}

const filterTypes = [
    { value: "all", label: "All Types" },
    { value: "employee_contribution", label: "Employee" },
    { value: "employer_contribution", label: "Employer" },
    { value: "interest_credit", label: "Interest" },
    { value: "withdrawal", label: "Withdrawal" },
    { value: "settlement", label: "Settlement" },
]

// ─── Animated Counter Component ──────────────────────────────────────────────

function AnimatedCounter({ value, prefix = "৳", duration = 1200 }: { value: number; prefix?: string; duration?: number }) {
    const [displayValue, setDisplayValue] = useState(0)
    const [mounted, setMounted] = useState(false)
    const previousValue = useRef(0)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return
        const startValue = previousValue.current
        const diff = value - startValue
        const startTime = performance.now()

        const animate = (now: number) => {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplayValue(Math.round(startValue + diff * eased))

            if (progress < 1) {
                requestAnimationFrame(animate)
            } else {
                previousValue.current = value
            }
        }

        requestAnimationFrame(animate)
    }, [value, duration, mounted])

    return (
        <span className="tabular-nums" suppressHydrationWarning>
            {prefix}{mounted ? displayValue.toLocaleString() : "0"}
        </span>
    )
}

// ─── Custom Chart Tooltip ────────────────────────────────────────────────────

function CustomChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
            <p className="text-xs text-zinc-400 mb-1.5">{label}</p>
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.stroke }} />
                    <span className="text-xs text-zinc-300">{p.name}:</span>
                    <span className="text-sm font-semibold text-white">৳{p.value?.toLocaleString("en-BD")}</span>
                </div>
            ))}
        </div>
    )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PFLedgerPage() {
    const [summary, setSummary] = useState<PFSummary | null>(null)
    const [transactions, setTransactions] = useState<PFTransaction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [employeeSearch, setEmployeeSearch] = useState("")
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [typeFilter, setTypeFilter] = useState("all")
    const [showDropdown, setShowDropdown] = useState(false)
    const t = useTranslations('PFLedger')

    const fetchPFData = useCallback(async (empId?: string) => {
        setIsLoading(true)
        try {
            const url = empId
                ? `/api/payroll/pf-ledger?employeeId=${empId}`
                : "/api/payroll/pf-ledger"
            const res = await fetch(url)
            if (res.ok) {
                const json = await res.json()
                setSummary(json.data?.summary || null)
                setTransactions(json.data?.transactions || [])
            }
        } catch (error) {
            console.error("Failed to fetch PF data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const fetchEmployees = useCallback(async () => {
        try {
            const res = await fetch("/api/employees?limit=500")
            if (res.ok) {
                const json = await res.json()
                const emps = (json.data || []).map((e: any) => ({
                    id: e.id,
                    name: `${e.firstName} ${e.lastName}`,
                    code: e.employeeCode,
                }))
                setEmployees(emps)
            }
        } catch { /* ignore */ }
    }, [])

    useEffect(() => {
        fetchPFData()
        fetchEmployees()
    }, [fetchPFData, fetchEmployees])

    const handleEmployeeSelect = (emp: Employee) => {
        setSelectedEmployeeId(emp.id)
        setEmployeeSearch(emp.name)
        setShowDropdown(false)
        fetchPFData(emp.id)
    }

    const filteredEmployees = employees.filter(
        (e) =>
            e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
            e.code.toLowerCase().includes(employeeSearch.toLowerCase())
    )

    const filteredTransactions = useMemo(() => {
        if (typeFilter === "all") return transactions
        return transactions.filter((tx) => tx.transactionType === typeFilter)
    }, [transactions, typeFilter])

    // Build chart data from transactions (running balance over time)
    const chartData = useMemo(() => {
        if (!transactions.length) return []
        const sorted = [...transactions].sort(
            (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
        )
        const monthMap = new Map<string, { balance: number; contributions: number }>()
        sorted.forEach((tx) => {
            const d = new Date(tx.transactionDate)
            const key = `${d.toLocaleString("en", { month: "short" })} '${String(d.getFullYear()).slice(2)}`
            const contrib = tx.transactionType.includes("contribution") ? tx.amount : 0
            const existing = monthMap.get(key)
            if (existing) {
                existing.balance = tx.runningBalance
                existing.contributions += contrib
            } else {
                monthMap.set(key, { balance: tx.runningBalance, contributions: contrib })
            }
        })
        return Array.from(monthMap.entries()).map(([month, data]) => ({
            month,
            balance: data.balance,
            contributions: data.contributions,
        }))
    }, [transactions])

    // ─── Loading State ───────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Landmark className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Provident Fund</h1>
                        <p className="text-sm text-muted-foreground">Loading account data...</p>
                    </div>
                </div>
                {/* Skeleton cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="overflow-hidden">
                            <CardContent className="pt-6">
                                <div className="space-y-3 animate-pulse">
                                    <div className="h-3 w-24 bg-muted rounded" />
                                    <div className="h-8 w-36 bg-muted rounded" />
                                    <div className="h-2 w-20 bg-muted rounded" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Card className="overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="h-64 bg-muted/50 rounded-xl animate-pulse" />
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
                        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                            <Landmark className="w-6 h-6 text-white" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight bg-linear-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                            {t('title')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <Download className="w-3.5 h-3.5" /> {t('exportCSV')}
                    </Button>
                </div>
            </div>

            {/* ── Employee Search (Fintech-style) ── */}
            <div className="relative">
                <div className="relative max-w-lg">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search employee by name or ID..."
                        className="pl-11 h-11 rounded-xl border-white/10 bg-card/80 backdrop-blur-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40 transition-all"
                        value={employeeSearch}
                        onChange={(e) => {
                            setEmployeeSearch(e.target.value)
                            setShowDropdown(true)
                        }}
                        onFocus={() => setShowDropdown(true)}
                    />
                    {selectedEmployeeId && (
                        <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-500/15 text-emerald-400 border-emerald-500/20 font-medium">
                            <Users className="w-3 h-3 mr-1" />
                            Selected
                        </Badge>
                    )}
                </div>

                {/* Dropdown */}
                {showDropdown && employeeSearch && filteredEmployees.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full max-w-lg rounded-xl border border-white/10 bg-card/95 backdrop-blur-2xl shadow-2xl shadow-black/20 overflow-hidden">
                        <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                            {filteredEmployees.slice(0, 8).map((emp) => (
                                <button
                                    key={emp.id}
                                    className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-emerald-500/8 transition-colors ${
                                        selectedEmployeeId === emp.id ? "bg-emerald-500/10" : ""
                                    }`}
                                    onClick={() => handleEmployeeSelect(emp)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                                            <span className="text-xs font-bold text-emerald-400">
                                                {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                            </span>
                                        </div>
                                        <span className="font-medium">{emp.name}</span>
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{emp.code}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Empty State ── */}
            {!summary ? (
                <Card className="overflow-hidden border-dashed">
                    <CardContent className="py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="relative mb-6">
                                <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                                    <PiggyBank className="w-10 h-10 text-emerald-500" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-linear-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold">{t('emptyTitle')}</h3>
                            <p className="text-muted-foreground mt-2 max-w-lg leading-relaxed">
                                {t('emptyDescription')}
                            </p>

                            {/* How PF Works — Info Cards */}
                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
                                <div className="rounded-xl border bg-muted/20 p-4 text-center">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
                                        <Users className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <p className="text-xs font-semibold">{t('step1Title')}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{t('step1Desc')}</p>
                                </div>
                                <div className="rounded-xl border bg-muted/20 p-4 text-center">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                                        <DollarSign className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <p className="text-xs font-semibold">{t('step2Title')}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{t('step2Desc')}</p>
                                </div>
                                <div className="rounded-xl border bg-muted/20 p-4 text-center">
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
                                        <PiggyBank className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <p className="text-xs font-semibold">{t('step3Title')}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{t('step3Desc')}</p>
                                </div>
                            </div>

                            <Link href="/payroll">
                                <Button className="mt-8 gap-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0">
                                    <DollarSign className="w-4 h-4" />
                                    {t('goToPayroll')}
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* ── Premium Stat Cards ── */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Total Balance — Hero Card */}
                        <Card className="relative overflow-hidden border-emerald-500/20">
                            <div className="absolute inset-0 bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-transparent" />
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                            <CardContent className="relative pt-6 pb-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="p-2.5 rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 shadow-lg shadow-emerald-500/10">
                                        <Wallet className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px] font-medium">
                                        <TrendingUp className="w-3 h-3 mr-1" /> LIVE
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('totalBalance')}</p>
                                <p className="text-3xl font-bold text-emerald-400 mt-1">
                                    <AnimatedCounter value={summary.totalBalance} />
                                </p>
                                <div className="flex items-center gap-1 mt-2">
                                    <div className="flex items-center gap-1 text-emerald-400">
                                        <TrendingUp className="w-3 h-3" />
                                        <span className="text-[11px] font-medium">{summary.interestRate}% p.a.</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">interest rate</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Employee Share */}
                        <Card className="relative overflow-hidden group hover:border-blue-500/20 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CardContent className="relative pt-6 pb-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="p-2.5 rounded-xl bg-blue-500/10">
                                        <ArrowUpRight className="w-5 h-5 text-blue-400" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('employeeContribution')}</p>
                                <p className="text-2xl font-bold mt-1">
                                    <AnimatedCounter value={summary.employeeBalance} />
                                </p>
                                <div className="mt-2">
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-linear-to-r from-blue-500 to-blue-400 transition-all duration-1000"
                                            style={{ width: `${summary.totalBalance > 0 ? (summary.employeeBalance / summary.totalBalance) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {summary.totalBalance > 0 ? Math.round((summary.employeeBalance / summary.totalBalance) * 100) : 0}% of total
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Employer Share */}
                        <Card className="relative overflow-hidden group hover:border-violet-500/20 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CardContent className="relative pt-6 pb-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="p-2.5 rounded-xl bg-violet-500/10">
                                        <DollarSign className="w-5 h-5 text-violet-400" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('employerContribution')}</p>
                                <p className="text-2xl font-bold mt-1">
                                    <AnimatedCounter value={summary.employerBalance} />
                                </p>
                                <div className="mt-2">
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-linear-to-r from-violet-500 to-violet-400 transition-all duration-1000"
                                            style={{ width: `${summary.totalBalance > 0 ? (summary.employerBalance / summary.totalBalance) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {summary.totalBalance > 0 ? Math.round((summary.employerBalance / summary.totalBalance) * 100) : 0}% of total
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Interest Earned */}
                        <Card className="relative overflow-hidden group hover:border-amber-500/20 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CardContent className="relative pt-6 pb-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="p-2.5 rounded-xl bg-amber-500/10">
                                        <Sparkles className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                        <Percent className="w-3 h-3 mr-0.5" />{summary.interestRate}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('interestAccrued')}</p>
                                <p className="text-2xl font-bold mt-1">
                                    <AnimatedCounter value={summary.interestBalance} />
                                </p>
                                <div className="mt-2">
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-400 transition-all duration-1000"
                                            style={{ width: `${summary.totalBalance > 0 ? (summary.interestBalance / summary.totalBalance) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {summary.totalBalance > 0 ? Math.round((summary.interestBalance / summary.totalBalance) * 100) : 0}% compound
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Account Meta Strip ── */}
                    <div className="flex flex-wrap items-center gap-3 px-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Status:</span>
                            <Badge variant="outline" className={summary.status === "active"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
                                : "bg-red-500/10 text-red-400 border-red-500/20 text-[10px]"
                            }>{summary.status}</Badge>
                        </div>
                        {summary.accountNumber && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>PF#:</span>
                                <code className="font-mono text-[11px] bg-muted/50 px-1.5 py-0.5 rounded">{summary.accountNumber}</code>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            <span suppressHydrationWarning>Since {new Date(summary.openingDate).toLocaleDateString("en-BD", { month: "short", year: "numeric" })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Activity className="w-3.5 h-3.5" />
                            <span>{summary.transactionCount} transactions</span>
                        </div>
                    </div>

                    {/* ── PF Growth Chart ── */}
                    {chartData.length > 1 && (
                        <Card className="overflow-hidden">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            {t('growthChart')}
                                        </CardTitle>
                                        <CardDescription>{t('growthChartDesc')}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-2 pb-4">
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="pfBalanceGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                                                <stop offset="50%" stopColor="#14B8A6" stopOpacity={0.12} />
                                                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="pfContribGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#6366F1" stopOpacity={0.25} />
                                                <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="hsl(var(--border))"
                                            vertical={false}
                                            opacity={0.4}
                                        />
                                        <XAxis
                                            dataKey="month"
                                            stroke="hsl(var(--muted-foreground))"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            dy={8}
                                        />
                                        <YAxis
                                            stroke="hsl(var(--muted-foreground))"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
                                            width={55}
                                        />
                                        <RechartsTooltip content={<CustomChartTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="balance"
                                            stroke="#10B981"
                                            strokeWidth={2.5}
                                            fill="url(#pfBalanceGradient)"
                                            name={t('balance')}
                                            dot={false}
                                            activeDot={{ r: 5, strokeWidth: 2, stroke: "#10B981", fill: "#0a0a0a" }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="contributions"
                                            stroke="#6366F1"
                                            strokeWidth={1.5}
                                            fill="url(#pfContribGradient)"
                                            name={t('contribution')}
                                            dot={false}
                                            strokeDasharray="4 2"
                                            activeDot={{ r: 4, strokeWidth: 2, stroke: "#6366F1", fill: "#0a0a0a" }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Transaction Ledger ── */}
                    <Card className="overflow-hidden">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-blue-500" />
                                            {t('transactionHistory')}
                                        </CardTitle>
                                        <CardDescription>{filteredTransactions.length} {t('noTransactions') !== t('noTransactions') ? '' : 'transactions'}</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                                        <SelectTrigger className="w-[160px] h-8 text-xs rounded-lg">
                                            <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filterTypes.map((f) => (
                                                <SelectItem key={f.value} value={f.value} className="text-xs">
                                                    {f.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                            {filteredTransactions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                                        <Activity className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium">{t('noTransactions')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {typeFilter !== "all" ? "Try changing the filter" : "Transactions will appear after the first payroll run"}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                                            <TableRow className="border-b border-white/5 hover:bg-transparent">
                                                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground pl-6 w-[130px]">{t('date')}</TableHead>
                                                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{t('type')}</TableHead>
                                                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground max-w-[240px]">{t('description')}</TableHead>
                                                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">{t('amount')}</TableHead>
                                                <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right pr-6">{t('runningBalance')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredTransactions.map((tx, index) => {
                                                const config = txTypeConfig[tx.transactionType] || txTypeConfig.adjustment
                                                const Icon = config.icon
                                                const isDebit = tx.amount < 0
                                                const isFirst = index === 0

                                                return (
                                                    <TableRow
                                                        key={tx.id}
                                                        className={`border-b border-white/3 hover:bg-white/2 transition-colors ${isFirst ? "bg-white/1" : ""}`}
                                                    >
                                                        <TableCell className="pl-6 py-4">
                                                            <div className="flex flex-col" suppressHydrationWarning>
                                                                <span className="text-sm font-medium">
                                                                    {new Date(tx.transactionDate).toLocaleDateString("en-BD", { day: "2-digit", month: "short" })}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {new Date(tx.transactionDate).getFullYear()}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-lg bg-linear-to-br ${config.gradient} flex items-center justify-center`}>
                                                                    <Icon className={`w-4 h-4 ${config.textColor}`} />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium">{config.label}</span>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                                                                        <span className="text-[10px] text-muted-foreground capitalize">{isDebit ? "debit" : "credit"}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4 max-w-[240px]">
                                                            <p className="text-sm text-muted-foreground truncate">{tx.description}</p>
                                                        </TableCell>
                                                        <TableCell className="py-4 text-right">
                                                            <span className={`text-sm font-semibold tabular-nums ${isDebit ? "text-red-400" : "text-emerald-400"}`}>
                                                                {isDebit ? "−" : "+"}৳{Math.abs(tx.amount).toLocaleString("en-BD")}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-4 text-right pr-6">
                                                            <span className="text-sm font-medium tabular-nums">
                                                                ৳{tx.runningBalance.toLocaleString("en-BD")}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
