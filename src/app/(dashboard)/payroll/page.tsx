"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    DollarSign,
    TrendingUp,
    Users,
    Calendar,
    Plus,
    Play,
    Download,
    FileText,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Clock,
    Landmark,
    FileCheck,
    Gift,
    Building2,
    Search,
    Shield,
    ArrowRight,
    Timer,
    Banknote,
    Lock,
    RotateCcw,
} from "lucide-react"
import { SalaryAssignmentForm } from "@/components/payroll/salary-assignment-form"
import { useToast } from "@/components/ui/toast"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { exportToExcel, formatPayrollExport } from "@/lib/export"
import { useTranslations } from "next-intl"

interface Assignment {
    id: string
    grossSalary: number
    effectiveFrom: string
    isActive: boolean
    employee: {
        id: string
        firstName: string
        lastName: string
        employeeCode: string
        designation?: { name: string }
    }
    salaryStructure: {
        id: string
        name: string
    }
    breakdown: {
        basic: number
        houseRent: number
        medical: number
        conveyance: number
        totalEarnings: number
        pfEmployee: number
        netSalary: number
    }
}

interface SalarySlip {
    id: string
    month: number
    year: number
    grossSalary: number
    netSalary: number
    totalDeductions: number
    status: string
    isLocked?: boolean
    isReversed?: boolean
    employee: {
        firstName: string
        lastName: string
        employeeCode: string
        department?: { name: string }
    }
}

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

export default function PayrollPage() {
    const { addToast } = useToast()
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const t = useTranslations('Payroll')
    const [activeTab, setActiveTab] = useState("overview")
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [slips, setSlips] = useState<SalarySlip[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [showAssignmentForm, setShowAssignmentForm] = useState(false)

    // Payroll processing state
    const [processMonth, setProcessMonth] = useState(new Date().getMonth() + 1)
    const [processYear, setProcessYear] = useState(new Date().getFullYear())

    const fetchData = async () => {
        try {
            setLoading(true)
            const [assignmentsRes, slipsRes] = await Promise.all([
                fetch("/api/payroll/assignments?active=true"),
                fetch(`/api/payroll/process?month=${processMonth}&year=${processYear}`)
            ])

            if (assignmentsRes.ok) {
                const assignmentsData = await assignmentsRes.json()
                setAssignments(Array.isArray(assignmentsData) ? assignmentsData : assignmentsData.data || [])
            }
            if (slipsRes.ok) {
                const slipsData = await slipsRes.json()
                setSlips(Array.isArray(slipsData) ? slipsData : slipsData.data || slipsData.slips || [])
            }
        } catch (error) {
            console.error("Failed to fetch payroll data", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [processMonth, processYear])

    const handleProcessPayroll = async () => {
        try {
            setProcessing(true)
            const res = await fetch("/api/payroll/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: processMonth, year: processYear }),
            })

            const result = await res.json()

            if (res.ok) {
                addToast({
                    title: t("payrollProcessed"),
                    description: `${result.processed} slips created, ${result.errors} errors`,
                    type: result.errors > 0 ? "warning" : "success",
                })
                fetchData()
            } else {
                throw new Error(result.error || t("payrollFailed"))
            }
        } catch (error) {
            addToast({
                title: t("payrollFailed"),
                description: error instanceof Error ? error.message : t("payrollFailed"),
                type: "error",
            })
        } finally {
            setProcessing(false)
        }
    }

    // Calculate statistics
    const totalPayroll = slips.reduce((sum, s) => sum + s.netSalary, 0)
    const totalDeductions = slips.reduce((sum, s) => sum + s.totalDeductions, 0)
    const pendingCount = slips.filter(s => s.status === "draft").length
    const paidCount = slips.filter(s => s.status === "paid").length

    // ── Slip workflow actions ──
    const [slipActionLoading, setSlipActionLoading] = useState<string | null>(null)

    const handleSlipAction = async (slipId: string, action: "approve" | "pay" | "lock" | "reverse" | "download") => {
        setSlipActionLoading(`${slipId}:${action}`)
        try {
            if (action === "download") {
                // Download payslip PDF
                const res = await fetch(`/api/payroll/slips/${slipId}/download`)
                if (res.ok) {
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `payslip-${slipId}.pdf`
                    a.click()
                    URL.revokeObjectURL(url)
                } else {
                    addToast({ title: "Download failed", type: "error" })
                }
            } else if (action === "lock") {
                const reason = prompt("Enter a reason for locking this slip:")
                if (!reason) return
                const res = await fetch(`/api/payroll/slips/${slipId}/lock`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reason }),
                })
                if (res.ok) {
                    addToast({ title: "Slip locked", type: "success" })
                    fetchData()
                } else {
                    const err = await res.json().catch(() => ({}))
                    addToast({ title: err.error || "Lock failed", type: "error" })
                }
            } else if (action === "reverse") {
                const reason = prompt("Enter a reason for reversing this slip:")
                if (!reason) return
                const res = await fetch(`/api/payroll/slips/${slipId}/reverse`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reason }),
                })
                if (res.ok) {
                    addToast({ title: "Slip reversed — you can re-process now", type: "success" })
                    fetchData()
                } else {
                    const err = await res.json().catch(() => ({}))
                    addToast({ title: err.error || "Reverse failed", type: "error" })
                }
            } else {
                // approve or pay
                const body = action === "pay" ? { paymentMode: "bank_transfer" } : {}
                const res = await fetch(`/api/payroll/slips/${slipId}/${action}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                })
                if (res.ok) {
                    const data = await res.json()
                    addToast({ title: data.message || `Slip ${action}d`, type: "success" })
                    fetchData()
                } else {
                    const err = await res.json().catch(() => ({}))
                    addToast({ title: err.error || `${action} failed`, type: "error" })
                }
            }
        } catch {
            addToast({ title: "Network error", type: "error" })
        } finally {
            setSlipActionLoading(null)
        }
    }

    const handleBulkApprove = async () => {
        const draftSlips = slips.filter(s => s.status === "draft")
        if (draftSlips.length === 0) {
            addToast({ title: "No draft slips to approve", type: "info" })
            return
        }
        const _ok = await confirm({ title: `Approve ${draftSlips.length} draft slip(s)?`, description: `All draft slips for ${months[processMonth - 1]} ${processYear} will be approved.`, confirmLabel: "Approve All", variant: "default" }); if (!_ok) return

        setSlipActionLoading("bulk-approve")
        try {
            const res = await fetch("/api/payroll/slips/bulk-approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: processMonth, year: processYear }),
            })
            if (res.ok) {
                const data = await res.json()
                addToast({ title: `${data.approved} slip(s) approved`, type: "success" })
                fetchData()
            } else {
                addToast({ title: "Bulk approve failed", type: "error" })
            }
        } catch {
            addToast({ title: "Network error", type: "error" })
        } finally {
            setSlipActionLoading(null)
        }
    }

    const handleGenerateBankFile = async () => {
        setSlipActionLoading("bank-file")
        try {
            const res = await fetch(`/api/payroll/bank-file?month=${processMonth}&year=${processYear}`)
            if (res.ok) {
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `bank-file-${processYear}-${processMonth}.csv`
                a.click()
                URL.revokeObjectURL(url)
                addToast({ title: "Bank file generated", type: "success" })
            } else {
                const err = await res.json().catch(() => ({}))
                addToast({ title: err.error || "Bank file generation failed", type: "error" })
            }
        } catch {
            addToast({ title: "Network error", type: "error" })
        } finally {
            setSlipActionLoading(null)
        }
    }

    const stats = [
        {
            title: t('totalPayroll'),
            value: `৳${totalPayroll.toLocaleString()}`,
            description: `${months[processMonth - 1]} ${processYear}`,
            icon: DollarSign,
            color: "from-emerald-500 to-green-600",
        },
        {
            title: t('activeAssignments'),
            value: assignments.length,
            description: t('employeesWithSalary'),
            icon: Users,
            color: "from-blue-500 to-indigo-600",
        },
        {
            title: t('pendingApproval'),
            value: pendingCount,
            description: t('draftSlips'),
            icon: Clock,
            color: "from-amber-500 to-orange-600",
        },
        {
            title: t('paid'),
            value: paidCount,
            description: t('thisMonth'),
            icon: CheckCircle2,
            color: "from-purple-500 to-pink-600",
        },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-foreground">{t('title')}</h1>
                    <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="border-card-border"
                        onClick={() => setShowAssignmentForm(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('assignSalary')}
                    </Button>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleProcessPayroll}
                        disabled={processing}
                    >
                        {processing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Play className="h-4 w-4 mr-2" />
                        )}
                        {t('runPayroll')}
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <Card key={i} className="bg-card border-card-border overflow-hidden">
                        <div className={`absolute inset-0 bg-linear-to-r ${stat.color} opacity-5`} />
                        <CardContent className="relative p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                                    <h3 className="text-2xl font-display font-bold text-foreground mt-1">{stat.value}</h3>
                                    <p className="text-xs text-tertiary-foreground mt-1">{stat.description}</p>
                                </div>
                                <div className={`p-3 rounded-xl bg-linear-to-r ${stat.color}`}>
                                    <stat.icon className="h-6 w-6 text-foreground" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-hover border-card-border flex-wrap">
                    <TabsTrigger value="overview">{t('overviewTab')}</TabsTrigger>
                    <TabsTrigger value="assignments">{t('assignmentsTab')}</TabsTrigger>
                    <TabsTrigger value="slips">{t('slipsTab')}</TabsTrigger>
                    <TabsTrigger value="tax">{t("taxCertTab")}</TabsTrigger>
                    <TabsTrigger value="bank">{t("bankFileTab")}</TabsTrigger>
                    <TabsTrigger value="encashment">{t("encashmentTab")}</TabsTrigger>
                    <TabsTrigger value="festival-bonus">{t("festivalBonusTab")}</TabsTrigger>
                    <TabsTrigger value="pf-ledger">{t("pfLedgerTab")}</TabsTrigger>
                    <TabsTrigger value="late-policy">{t("latePolicyTab")}</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                    {/* Month/Year Selector */}
                    <Card className="bg-card border-card-border">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-blue-400" />
                                {t('selectPeriod')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">{t('month')}</label>
                                    <select
                                        value={processMonth}
                                        onChange={(e) => setProcessMonth(parseInt(e.target.value))}
                                        className="w-40 bg-hover border border-card-border rounded-lg px-3 py-2 text-foreground"
                                    >
                                        {months.map((m, i) => (
                                            <option key={i} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">{t('year')}</label>
                                    <Input
                                        type="number"
                                        value={processYear}
                                        onChange={(e) => setProcessYear(parseInt(e.target.value))}
                                        className="w-32 bg-hover border-card-border text-foreground"
                                    />
                                </div>
                                <Button onClick={fetchData} variant="outline" className="border-card-border">
                                    {t('loadData')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payroll Summary */}
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('payrollSummary')} - {months[processMonth - 1]} {processYear}</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {slips.length} {t('slipsGenerated')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {slips.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText className="h-12 w-12 mx-auto text-muted-text" />
                                    <p className="text-muted-foreground mt-4">{t('noSlipsForPeriod')}</p>
                                    <Button
                                        className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                                        onClick={handleProcessPayroll}
                                        disabled={processing}
                                    >
                                        {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                        {t('processPayroll')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <p className="text-emerald-400 text-sm">{t('totalGross')}</p>
                                            <p className="text-2xl font-display font-bold text-foreground">
                                                ৳{slips.reduce((s, sl) => s + sl.grossSalary, 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                                            <p className="text-red-400 text-sm">{t('totalDeductions')}</p>
                                            <p className="text-2xl font-display font-bold text-foreground">
                                                ৳{totalDeductions.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                            <p className="text-blue-400 text-sm">{t('netPayable')}</p>
                                            <p className="text-2xl font-display font-bold text-foreground">
                                                ৳{totalPayroll.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="assignments" className="mt-4">
                    <Card className="bg-card border-card-border">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-foreground">{t('activeAssignmentsTitle')}</CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    {assignments.length} {t('employeesWithAssignedSalary')}
                                </CardDescription>
                            </div>
                            <Button onClick={() => setShowAssignmentForm(true)} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="h-4 w-4 mr-2" />
                                {t('newAssignment')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-tertiary-foreground" />
                                </div>
                            ) : assignments.length === 0 ? (
                                <div className="text-center py-12">
                                    <Users className="h-12 w-12 mx-auto text-muted-text" />
                                    <p className="text-muted-foreground mt-4">{t('noAssignmentsYet')}</p>
                                    <Button
                                        className="mt-4"
                                        onClick={() => setShowAssignmentForm(true)}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        {t('assignFirstSalary')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-card-border text-left text-muted-foreground">
                                                <th className="pb-3 font-medium">{t('employee')}</th>
                                                <th className="pb-3 font-medium">{t('structure')}</th>
                                                <th className="pb-3 font-medium text-right">{t('gross')}</th>
                                                <th className="pb-3 font-medium text-right">{t('basic')}</th>
                                                <th className="pb-3 font-medium text-right">{t('netSalary')}</th>
                                                <th className="pb-3 font-medium">{t('effectiveFrom')}</th>
                                                <th className="pb-3 font-medium">{t('status')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {assignments.map((a) => (
                                                <tr key={a.id} className="text-foreground hover:bg-hover">
                                                    <td className="py-4">
                                                        <div>
                                                            <p className="font-medium text-foreground">
                                                                {a.employee.firstName} {a.employee.lastName}
                                                            </p>
                                                            <p className="text-sm text-tertiary-foreground">
                                                                {a.employee.employeeCode}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="py-4">{a.salaryStructure.name}</td>
                                                    <td className="py-4 text-right">৳{a.grossSalary.toLocaleString()}</td>
                                                    <td className="py-4 text-right">৳{a.breakdown.basic.toLocaleString()}</td>
                                                    <td className="py-4 text-right font-semibold text-emerald-400">
                                                        ৳{a.breakdown.netSalary.toLocaleString()}
                                                    </td>
                                                    <td className="py-4">
                                                        {new Date(a.effectiveFrom).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-4">
                                                        <Badge variant={a.isActive ? "success" : "secondary"}>
                                                            {a.isActive ? t('active') : t('inactive')}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="slips" className="mt-4">
                    <Card className="bg-card border-card-border">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-foreground">
                                    {t('slipsTab')} - {months[processMonth - 1]} {processYear}
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    {slips.length} {t('slipsGenerated')}
                                    {pendingCount > 0 && (
                                        <span className="ml-2 text-amber-400">
                                            ({pendingCount} draft awaiting approval)
                                        </span>
                                    )}
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                {pendingCount > 0 && (
                                    <Button
                                        variant="outline"
                                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                        onClick={handleBulkApprove}
                                        disabled={slipActionLoading === "bulk-approve"}
                                    >
                                        {slipActionLoading === "bulk-approve" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                        Bulk Approve ({pendingCount})
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    className="border-card-border"
                                    disabled={slips.length === 0}
                                    onClick={() => {
                                        const formatted = formatPayrollExport(slips)
                                        exportToExcel(formatted, {
                                            filename: `Salary_Slips_${months[processMonth - 1]}_${processYear}`,
                                            sheetName: "Salary Slips",
                                        })
                                    }}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    {t('exportAll')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {slips.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText className="h-12 w-12 mx-auto text-muted-text" />
                                    <p className="text-muted-foreground mt-4">{t('noSlipsThisPeriod')}</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-card-border text-left text-muted-foreground">
                                                <th className="pb-3 font-medium">{t('employee')}</th>
                                                <th className="pb-3 font-medium">{t('department')}</th>
                                                <th className="pb-3 font-medium text-right">{t('gross')}</th>
                                                <th className="pb-3 font-medium text-right">{t('deductions')}</th>
                                                <th className="pb-3 font-medium text-right">{t('netSalary')}</th>
                                                <th className="pb-3 font-medium">{t('status')}</th>
                                                <th className="pb-3 font-medium">{t('actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {slips.map((slip) => (
                                                <tr key={slip.id} className="text-foreground hover:bg-hover">
                                                    <td className="py-4">
                                                        <div>
                                                            <p className="font-medium text-foreground">
                                                                {slip.employee.firstName} {slip.employee.lastName}
                                                            </p>
                                                            <p className="text-sm text-tertiary-foreground">
                                                                {slip.employee.employeeCode}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="py-4">{slip.employee.department?.name || "-"}</td>
                                                    <td className="py-4 text-right">৳{slip.grossSalary.toLocaleString()}</td>
                                                    <td className="py-4 text-right text-red-400">
                                                        -৳{slip.totalDeductions.toLocaleString()}
                                                    </td>
                                                    <td className="py-4 text-right font-semibold text-emerald-400">
                                                        ৳{slip.netSalary.toLocaleString()}
                                                    </td>
                                                    <td className="py-4">
                                                        <Badge
                                                            variant={
                                                                slip.status === "paid" ? "success" :
                                                                    slip.status === "approved" ? "default" : "secondary"
                                                            }
                                                        >
                                                            {slip.status}
                                                            {slip.isLocked && " 🔒"}
                                                            {slip.isReversed && " ↩"}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-4">
                                                        <div className="flex gap-1">
                                                            {/* Download PDF */}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                                onClick={() => handleSlipAction(slip.id, "download")}
                                                                disabled={slipActionLoading === `${slip.id}:download`}
                                                                title="Download PDF"
                                                            >
                                                                {slipActionLoading === `${slip.id}:download` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                            </Button>
                                                            {/* Approve (draft → approved) */}
                                                            {slip.status === "draft" && !slip.isReversed && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                                                    onClick={() => handleSlipAction(slip.id, "approve")}
                                                                    disabled={slipActionLoading === `${slip.id}:approve`}
                                                                    title="Approve"
                                                                >
                                                                    {slipActionLoading === `${slip.id}:approve` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                                </Button>
                                                            )}
                                                            {/* Pay (approved → paid) */}
                                                            {(slip.status === "approved" || slip.status === "draft") && !slip.isReversed && !slip.isLocked && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                                                    onClick={() => handleSlipAction(slip.id, "pay")}
                                                                    disabled={slipActionLoading === `${slip.id}:pay`}
                                                                    title="Mark as Paid"
                                                                >
                                                                    {slipActionLoading === `${slip.id}:pay` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                                                                </Button>
                                                            )}
                                                            {/* Lock (paid → locked) */}
                                                            {slip.status === "paid" && !slip.isLocked && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                                                    onClick={() => handleSlipAction(slip.id, "lock")}
                                                                    disabled={slipActionLoading === `${slip.id}:lock`}
                                                                    title="Lock"
                                                                >
                                                                    {slipActionLoading === `${slip.id}:lock` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                                                                </Button>
                                                            )}
                                                            {/* Reverse (for correction) */}
                                                            {(slip.status === "paid" || slip.status === "approved") && !slip.isReversed && !slip.isLocked && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                                    onClick={() => handleSlipAction(slip.id, "reverse")}
                                                                    disabled={slipActionLoading === `${slip.id}:reverse`}
                                                                    title="Reverse for correction"
                                                                >
                                                                    {slipActionLoading === `${slip.id}:reverse` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tax Certificate Tab */}
                <TabsContent value="tax" className="mt-4 space-y-4">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Shield className="h-5 w-5 text-indigo-400" />
                                {t("annualTaxComputation")}
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {t("annualTaxDesc")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {/* Fiscal Year Selector */}
                                <div className="flex flex-col sm:flex-row gap-4 items-end">
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground">{t("fiscalYear")}</label>
                                        <select className="w-48 bg-hover border border-card-border rounded-lg px-3 py-2 text-foreground">
                                            <option>2025-2026</option>
                                            <option>2024-2025</option>
                                            <option>2023-2024</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <label className="text-sm text-muted-foreground">{t("employeeOptional")}</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder={t("searchEmployee")} className="pl-10 bg-hover border-card-border text-foreground" />
                                        </div>
                                    </div>
                                    <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                                        <FileCheck className="h-4 w-4" />
                                        {t("generateCertificate")}
                                    </Button>
                                </div>

                                {/* Tax Breakdown Preview */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                        <p className="text-sm text-indigo-400">{t("totalTaxableIncome")}</p>
                                        <p className="text-2xl font-display font-bold text-foreground mt-1">৳0</p>
                                        <p className="text-xs text-muted-foreground mt-1">{t("basedOnAnnualSalary")}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                        <p className="text-sm text-amber-400">{t("taxDeductedTDS")}</p>
                                        <p className="text-2xl font-display font-bold text-foreground mt-1">৳0</p>
                                        <p className="text-xs text-muted-foreground mt-1">{t("monthlyDeductionsSum")}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <p className="text-sm text-emerald-400">{t("investmentRebate")}</p>
                                        <p className="text-2xl font-display font-bold text-foreground mt-1">৳0</p>
                                        <p className="text-xs text-muted-foreground mt-1">{t("underSection78")}</p>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                    <AlertCircle className="h-5 w-5 text-blue-400 shrink-0" />
                                    <p className="text-sm text-blue-400">
                                        {t("taxCertNote")}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Bank File Tab */}
                <TabsContent value="bank" className="mt-4 space-y-4">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Landmark className="h-5 w-5 text-cyan-400" />
                                {t("bankTransferBEFTN")}
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {t("bankTransferDesc")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {/* Period + Bank Selection */}
                                <div className="flex flex-col sm:flex-row gap-4 items-end">
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground">{t("month")}</label>
                                        <select
                                            value={processMonth}
                                            onChange={(e) => setProcessMonth(parseInt(e.target.value))}
                                            className="w-40 bg-hover border border-card-border rounded-lg px-3 py-2 text-foreground"
                                        >
                                            {months.map((m, i) => (
                                                <option key={i} value={i + 1}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground">{t("year")}</label>
                                        <Input
                                            type="number"
                                            value={processYear}
                                            onChange={(e) => setProcessYear(parseInt(e.target.value))}
                                            className="w-32 bg-hover border-card-border text-foreground"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground">{t("bankFormat")}</label>
                                        <select className="w-48 bg-hover border border-card-border rounded-lg px-3 py-2 text-foreground">
                                            <option>BEFTN (Standard)</option>
                                            <option>BACH (Batch)</option>
                                            <option>EFT (Individual)</option>
                                        </select>
                                    </div>
                                    <Button
                                        className="bg-cyan-600 hover:bg-cyan-700 gap-2"
                                        onClick={handleGenerateBankFile}
                                        disabled={slipActionLoading === "bank-file" || slips.length === 0}
                                    >
                                        {slipActionLoading === "bank-file" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                        {t("generateFile")}
                                    </Button>
                                </div>

                                {/* Bank Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: t("totalRecipients"), value: slips.length, bgColor: "bg-cyan-500/10 border-cyan-500/20", textColor: "text-cyan-400" },
                                        { label: t("totalAmountLabel"), value: `৳${slips.reduce((s, sl) => s + sl.netSalary, 0).toLocaleString()}`, bgColor: "bg-emerald-500/10 border-emerald-500/20", textColor: "text-emerald-400" },
                                        { label: t("banks"), value: "—", bgColor: "bg-purple-500/10 border-purple-500/20", textColor: "text-purple-400" },
                                        { label: t("statusLabel"), value: slips.length > 0 ? t("readyStatus") : t("noDataStatus"), bgColor: "bg-amber-500/10 border-amber-500/20", textColor: "text-amber-400" },
                                    ].map((item, i) => (
                                        <div key={i} className={`p-4 rounded-xl border ${item.bgColor}`}>
                                            <p className={`text-sm ${item.textColor}`}>{item.label}</p>
                                            <p className="text-xl font-display font-bold text-foreground mt-1">{item.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Employees with bank details */}
                                {slips.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-card-border text-left text-muted-foreground">
                                                    <th className="pb-3 font-medium">{t("bankTableEmployee")}</th>
                                                    <th className="pb-3 font-medium">{t("bankTableBank")}</th>
                                                    <th className="pb-3 font-medium">{t("bankTableAccount")}</th>
                                                    <th className="pb-3 font-medium text-right">{t("bankTableNetAmount")}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {slips.slice(0, 10).map((slip) => (
                                                    <tr key={slip.id} className="text-foreground hover:bg-hover">
                                                        <td className="py-3">
                                                            <p className="font-medium">{slip.employee.firstName} {slip.employee.lastName}</p>
                                                            <p className="text-xs text-tertiary-foreground">{slip.employee.employeeCode}</p>
                                                        </td>
                                                        <td className="py-3 text-muted-foreground">—</td>
                                                        <td className="py-3 text-muted-foreground">—</td>
                                                        <td className="py-3 text-right font-semibold text-emerald-400">
                                                            ৳{slip.netSalary.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {slips.length === 0 && (
                                    <div className="text-center py-12">
                                        <Landmark className="h-12 w-12 mx-auto text-muted-text" />
                                        <p className="text-muted-foreground mt-4">{t("processPayrollFirst")}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Leave Encashment Tab */}
                <TabsContent value="encashment" className="mt-4 space-y-4">
                    <Card className="bg-card border-card-border">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <Gift className="h-5 w-5 text-amber-400" />
                                    {t("leaveEncashment")}
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    {t("leaveEncashmentDesc")}
                                </CardDescription>
                            </div>
                            <Button className="bg-amber-600 hover:bg-amber-700 gap-2">
                                <Plus className="h-4 w-4" />
                                {t("newEncashment")}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {/* Encashment Stats */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                        <p className="text-sm text-amber-400">{t("pendingRequests")}</p>
                                        <p className="text-2xl font-display font-bold text-foreground mt-1">0</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <p className="text-sm text-emerald-400">{t("processedThisYear")}</p>
                                        <p className="text-2xl font-display font-bold text-foreground mt-1">0</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                        <p className="text-sm text-purple-400">{t("totalPayout")}</p>
                                        <p className="text-2xl font-display font-bold text-foreground mt-1">৳0</p>
                                    </div>
                                </div>

                                {/* Empty State */}
                                <div className="text-center py-12">
                                    <Gift className="h-12 w-12 mx-auto text-muted-text" />
                                    <p className="text-muted-foreground mt-4">{t("noEncashmentYet")}</p>
                                    <p className="text-sm text-tertiary-foreground mt-2">
                                        {t("noEncashmentDesc")}
                                    </p>
                                </div>

                                {/* Policy Note */}
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
                                    <p className="text-sm text-amber-400">
                                        {t("encashmentNote")}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Festival Bonus Portal ── */}
                <TabsContent value="festival-bonus" className="mt-4">
                    <Link href="/payroll/festival-bonus" className="block group">
                        <Card className="relative overflow-hidden border-amber-500/15 hover:border-amber-500/30 transition-all cursor-pointer">
                            <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 via-transparent to-orange-500/5" />
                            <CardContent className="relative py-10">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Gift className="w-8 h-8 text-amber-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold">{t("festivalBonusTitle")}</h3>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                        {t("festivalBonusDesc")}
                                    </p>
                                    <div className="flex items-center gap-2 mt-4 text-amber-400 text-sm font-medium">
                                        {t("openEngine")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </TabsContent>

                {/* ── PF Ledger Portal ── */}
                <TabsContent value="pf-ledger" className="mt-4">
                    <Link href="/payroll/pf-ledger" className="block group">
                        <Card className="relative overflow-hidden border-emerald-500/15 hover:border-emerald-500/30 transition-all cursor-pointer">
                            <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 via-transparent to-teal-500/5" />
                            <CardContent className="relative py-10">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Landmark className="w-8 h-8 text-emerald-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold">{t("pfLedgerTitle")}</h3>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                        {t("pfLedgerDesc")}
                                    </p>
                                    <div className="flex items-center gap-2 mt-4 text-emerald-400 text-sm font-medium">
                                        {t("openLedger")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </TabsContent>

                {/* ── Late Policy Portal ── */}
                <TabsContent value="late-policy" className="mt-4">
                    <Link href="/settings/late-deduction" className="block group">
                        <Card className="relative overflow-hidden border-rose-500/15 hover:border-rose-500/30 transition-all cursor-pointer">
                            <div className="absolute inset-0 bg-linear-to-br from-rose-500/5 via-transparent to-red-500/5" />
                            <CardContent className="relative py-10">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-rose-500/20 to-red-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Timer className="w-8 h-8 text-rose-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold">{t("latePolicyTitle")}</h3>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                        {t("latePolicyDesc")}
                                    </p>
                                    <div className="flex items-center gap-2 mt-4 text-rose-400 text-sm font-medium">
                                        {t("openPolicyBuilder")} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </TabsContent>
            </Tabs>

            {/* Salary Assignment Form */}
            <SalaryAssignmentForm
                open={showAssignmentForm}
                onOpenChange={setShowAssignmentForm}
                onSuccess={fetchData}
            />
        </div>
    )
}
