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
            title: "Total Payroll",
            value: `৳${totalPayroll.toLocaleString()}`,
            description: `${months[processMonth - 1]} ${processYear}`,
            icon: DollarSign,
            color: "from-emerald-500 to-green-600",
        },
        {
            title: "Active Assignments",
            value: assignments.length,
            description: "Employees with salary",
            icon: Users,
            color: "from-blue-500 to-indigo-600",
        },
        {
            title: "Pending Approval",
            value: pendingCount,
            description: "Draft slips",
            icon: Clock,
            color: "from-amber-500 to-orange-600",
        },
        {
            title: "Paid",
            value: paidCount,
            description: "This month",
            icon: CheckCircle2,
            color: "from-purple-500 to-pink-600",
        },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Payroll Management</h1>
                    <p className="text-white/60 mt-1">Process salaries and manage payroll</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="border-white/10"
                        onClick={() => setShowAssignmentForm(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Assign Salary
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
                        Run Payroll
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <Card key={i} className="bg-[#12121A] border-white/10 overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-r ${stat.color} opacity-5`} />
                        <CardContent className="relative p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white/60">{stat.title}</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
                                    <p className="text-xs text-white/40 mt-1">{stat.description}</p>
                                </div>
                                <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color}`}>
                                    <stat.icon className="h-6 w-6 text-white" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-white/5 border-white/10">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="assignments">Salary Assignments</TabsTrigger>
                    <TabsTrigger value="slips">Salary Slips</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                    {/* Month/Year Selector */}
                    <Card className="bg-[#12121A] border-white/10">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-white flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-blue-400" />
                                Select Payroll Period
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4 items-end">
                                <div className="space-y-2">
                                    <label className="text-sm text-white/60">Month</label>
                                    <select
                                        value={processMonth}
                                        onChange={(e) => setProcessMonth(parseInt(e.target.value))}
                                        className="w-40 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                                    >
                                        {months.map((m, i) => (
                                            <option key={i} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-white/60">Year</label>
                                    <Input
                                        type="number"
                                        value={processYear}
                                        onChange={(e) => setProcessYear(parseInt(e.target.value))}
                                        className="w-32 bg-white/5 border-white/10 text-white"
                                    />
                                </div>
                                <Button onClick={fetchData} variant="outline" className="border-white/10">
                                    Load Data
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payroll Summary */}
                    <Card className="bg-[#12121A] border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white">Payroll Summary - {months[processMonth - 1]} {processYear}</CardTitle>
                            <CardDescription className="text-white/60">
                                {slips.length} salary slips generated
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {slips.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText className="h-12 w-12 mx-auto text-white/20" />
                                    <p className="text-white/60 mt-4">No salary slips for this period</p>
                                    <Button
                                        className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                                        onClick={handleProcessPayroll}
                                        disabled={processing}
                                    >
                                        {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                        Process Payroll
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <p className="text-emerald-400 text-sm">Total Gross</p>
                                            <p className="text-2xl font-bold text-white">
                                                ৳{slips.reduce((s, sl) => s + sl.grossSalary, 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                                            <p className="text-red-400 text-sm">Total Deductions</p>
                                            <p className="text-2xl font-bold text-white">
                                                ৳{totalDeductions.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                            <p className="text-blue-400 text-sm">Net Payable</p>
                                            <p className="text-2xl font-bold text-white">
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
                    <Card className="bg-[#12121A] border-white/10">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-white">Active Salary Assignments</CardTitle>
                                <CardDescription className="text-white/60">
                                    {assignments.length} employees with assigned salary
                                </CardDescription>
                            </div>
                            <Button onClick={() => setShowAssignmentForm(true)} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="h-4 w-4 mr-2" />
                                New Assignment
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-white/40" />
                                </div>
                            ) : assignments.length === 0 ? (
                                <div className="text-center py-12">
                                    <Users className="h-12 w-12 mx-auto text-white/20" />
                                    <p className="text-white/60 mt-4">No salary assignments yet</p>
                                    <Button
                                        className="mt-4"
                                        onClick={() => setShowAssignmentForm(true)}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Assign First Salary
                                    </Button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-white/10 text-left text-white/60">
                                                <th className="pb-3 font-medium">Employee</th>
                                                <th className="pb-3 font-medium">Structure</th>
                                                <th className="pb-3 font-medium text-right">Gross</th>
                                                <th className="pb-3 font-medium text-right">Basic</th>
                                                <th className="pb-3 font-medium text-right">Net Salary</th>
                                                <th className="pb-3 font-medium">Effective From</th>
                                                <th className="pb-3 font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {assignments.map((a) => (
                                                <tr key={a.id} className="text-white/80 hover:bg-white/5">
                                                    <td className="py-4">
                                                        <div>
                                                            <p className="font-medium text-white">
                                                                {a.employee.firstName} {a.employee.lastName}
                                                            </p>
                                                            <p className="text-sm text-white/50">
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
                                                            {a.isActive ? "Active" : "Inactive"}
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
                    <Card className="bg-[#12121A] border-white/10">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-white">
                                    Salary Slips - {months[processMonth - 1]} {processYear}
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    {slips.length} slips generated
                                </CardDescription>
                            </div>
                            <Button variant="outline" className="border-white/10">
                                <Download className="h-4 w-4 mr-2" />
                                Export All
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {slips.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText className="h-12 w-12 mx-auto text-white/20" />
                                    <p className="text-white/60 mt-4">No slips for this period</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-white/10 text-left text-white/60">
                                                <th className="pb-3 font-medium">Employee</th>
                                                <th className="pb-3 font-medium">Department</th>
                                                <th className="pb-3 font-medium text-right">Gross</th>
                                                <th className="pb-3 font-medium text-right">Deductions</th>
                                                <th className="pb-3 font-medium text-right">Net Salary</th>
                                                <th className="pb-3 font-medium">Status</th>
                                                <th className="pb-3 font-medium">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {slips.map((slip) => (
                                                <tr key={slip.id} className="text-white/80 hover:bg-white/5">
                                                    <td className="py-4">
                                                        <div>
                                                            <p className="font-medium text-white">
                                                                {slip.employee.firstName} {slip.employee.lastName}
                                                            </p>
                                                            <p className="text-sm text-white/50">
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
                                                        <Button size="sm" variant="ghost" className="text-white/60 hover:text-white">
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
