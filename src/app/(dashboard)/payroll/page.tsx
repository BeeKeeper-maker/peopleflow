"use client"

import { useState, useEffect } from "react"
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
    Clock
} from "lucide-react"
import { SalaryAssignmentForm } from "@/components/payroll/salary-assignment-form"
import { useToast } from "@/components/ui/toast"
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
                setAssignments(await assignmentsRes.json())
            }
            if (slipsRes.ok) {
                setSlips(await slipsRes.json())
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
                    title: "Payroll Processed",
                    description: `${result.processed} slips created, ${result.errors} errors`,
                    type: result.errors > 0 ? "warning" : "success",
                })
                fetchData()
            } else {
                throw new Error(result.error || "Failed to process payroll")
            }
        } catch (error) {
            addToast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to process payroll",
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
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
                                    <h3 className="text-2xl font-bold text-foreground mt-1">{stat.value}</h3>
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
                <TabsList className="bg-hover border-card-border">
                    <TabsTrigger value="overview">{t('overviewTab')}</TabsTrigger>
                    <TabsTrigger value="assignments">{t('assignmentsTab')}</TabsTrigger>
                    <TabsTrigger value="slips">{t('slipsTab')}</TabsTrigger>
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
                            <div className="flex gap-4 items-end">
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
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <p className="text-emerald-400 text-sm">{t('totalGross')}</p>
                                            <p className="text-2xl font-bold text-foreground">
                                                ৳{slips.reduce((s, sl) => s + sl.grossSalary, 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                                            <p className="text-red-400 text-sm">{t('totalDeductions')}</p>
                                            <p className="text-2xl font-bold text-foreground">
                                                ৳{totalDeductions.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                            <p className="text-blue-400 text-sm">{t('netPayable')}</p>
                                            <p className="text-2xl font-bold text-foreground">
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
                                        <tbody className="divide-y divide-white/5">
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
                                </CardDescription>
                            </div>
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
                                        <tbody className="divide-y divide-white/5">
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
                                                        </Badge>
                                                    </td>
                                                    <td className="py-4">
                                                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                                                            <Download className="h-4 w-4" />
                                                        </Button>
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
