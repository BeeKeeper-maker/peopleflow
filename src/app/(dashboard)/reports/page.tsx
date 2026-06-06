"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    BarChart3,
    Users,
    Calendar,
    Clock,
    DollarSign,
    Download,
    FileSpreadsheet,
    FileText,
    RefreshCw,
    TrendingUp,
    Loader2,
    ShieldCheck,
    AlertTriangle,
    Target,
} from "lucide-react"
import {
    exportToExcel,
    exportToCSV,
    formatEmployeeExport,
    formatAttendanceExport,
    formatLeaveExport,
    formatPayrollExport
} from "@/lib/export"
import { useToast } from "@/components/ui/toast"
import { AttendanceCharts } from "@/components/reports/attendance-charts"
import { LateEarlyTable, type LateEarlyRecord } from "@/components/reports/late-early-table"
import { useTranslations } from "next-intl"

interface ReportCard {
    id: string
    title: string
    description: string
    icon: React.ReactNode
    color: string
    count?: number | string
}

interface AttendanceReportData {
    daily?: Record<string, number>
    monthly?: Array<Record<string, number | string>>
    offenders?: LateEarlyRecord[]
}

interface EmployeeRecord {
    employmentStatus?: string
}

export default function ReportsPage() {
    const { addToast } = useToast()
    const t = useTranslations('Reports')
    const [activeTab, setActiveTab] = useState("overview")
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState<string | null>(null)
    const [attendanceData, setAttendanceData] = useState<AttendanceReportData | null>(null)
    const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"))
    const [reportYear, setReportYear] = useState(String(new Date().getFullYear()))
    const [stats, setStats] = useState({
        totalEmployees: 0,
        activeEmployees: 0,
        pendingLeaves: 0,
        avgAttendance: 0,
        monthlyPayroll: 0,
    })

    // Fetch stats
    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true)
            try {
                const [empRes, attRes] = await Promise.all([
                    fetch("/api/employees?limit=1000"),
                    fetch("/api/reports/attendance")
                ])

                if (empRes.ok) {
                    const data = await empRes.json()
                    const empList: EmployeeRecord[] = Array.isArray(data) ? data : data.data || []
                    setStats(prev => ({
                        ...prev,
                        totalEmployees: data.meta?.total || empList.length || 0,
                        activeEmployees: empList.filter((e) => e.employmentStatus === "active").length || 0,
                    }))
                }

                if (attRes.ok) {
                    const report = await attRes.json() as AttendanceReportData
                    setAttendanceData(report)
                    const daily = report.daily || {}
                    const presentish = (daily.present || 0) + (daily.late || 0) + (daily.half_day || 0) + (daily["half-day"] || 0)
                    const total = presentish + (daily.absent || 0)
                    setStats(prev => ({ ...prev, avgAttendance: total > 0 ? Math.round((presentish / total) * 100) : 0 }))
                }
            } catch (error) {
                console.error("Failed to fetch stats", error)
            } finally {
                setLoading(false)
            }
        }
        fetchStats()
    }, [])

    const handleExport = async (reportType: string, format: "excel" | "csv") => {
        setExporting(`${reportType}-${format}`)
        try {
            let data: unknown[] = []
            let formattedData: Record<string, unknown>[] = []
            let filename = ""

            switch (reportType) {
                case "employees":
                    const empRes = await fetch("/api/employees?limit=1000")
                    if (!empRes.ok) throw new Error("Failed to fetch employees")
                    const empData = await empRes.json()
                    data = Array.isArray(empData) ? empData : empData.data || []
                    formattedData = formatEmployeeExport(data)
                    filename = `employees_report_${new Date().toISOString().split("T")[0]}`
                    break

                case "attendance":
                    const month = Number(reportMonth)
                    const year = Number(reportYear)
                    const attRes = await fetch(`/api/reports/attendance?month=${month}&year=${year}`)
                    if (!attRes.ok) throw new Error("Failed to fetch attendance")
                    const attData = await attRes.json()
                    data = Array.isArray(attData) ? attData : attData.data || attData.records || []
                    formattedData = formatAttendanceExport(Array.isArray(data) ? data : [])
                    filename = `attendance_report_${month}_${year}`
                    break

                case "leaves":
                    const leaveRes = await fetch("/api/leaves/applications")
                    if (!leaveRes.ok) throw new Error("Failed to fetch leaves")
                    const leaveData = await leaveRes.json()
                    data = Array.isArray(leaveData) ? leaveData : leaveData.data || []
                    formattedData = formatLeaveExport(data)
                    filename = `leave_report_${new Date().toISOString().split("T")[0]}`
                    break

                case "payroll":
                    const payMonth = Number(reportMonth)
                    const payYear = Number(reportYear)
                    const payRes = await fetch(`/api/payroll/process?month=${payMonth}&year=${payYear}`)
                    if (!payRes.ok) throw new Error("Failed to fetch payroll")
                    const payData = await payRes.json()
                    data = Array.isArray(payData) ? payData : payData.data || payData.slips || []
                    formattedData = formatPayrollExport(data)
                    filename = `payroll_report_${payMonth}_${payYear}`
                    break

                default:
                    throw new Error("Unknown report type")
            }

            if (formattedData.length === 0) {
                addToast({
                    title: "No data",
                    description: "No data available for this report",
                    type: "warning",
                })
                return
            }

            if (format === "excel") {
                exportToExcel(formattedData, { filename, sheetName: reportType })
            } else {
                exportToCSV(formattedData, { filename })
            }

            addToast({
                title: "Export successful",
                description: `${reportType} report exported as ${format.toUpperCase()}`,
                type: "success",
            })
        } catch (error) {
            addToast({
                title: "Export failed",
                description: error instanceof Error ? error.message : "Failed to export report",
                type: "error",
            })
        } finally {
            setExporting(null)
        }
    }

    const reportCards: ReportCard[] = [
        {
            id: "employees",
            title: t('employeeReport'),
            description: t('employeeReportDesc'),
            icon: <Users className="h-5 w-5" />,
            color: "from-blue-500 to-indigo-600",
            count: stats.totalEmployees,
        },
        {
            id: "attendance",
            title: t('attendanceReport'),
            description: t('attendanceReportDesc'),
            icon: <Clock className="h-5 w-5" />,
            color: "from-emerald-500 to-green-600",
            count: t('currentMonth'),
        },
        {
            id: "leaves",
            title: t('leaveReport'),
            description: t('leaveReportDesc'),
            icon: <Calendar className="h-5 w-5" />,
            color: "from-amber-500 to-orange-600",
            count: `${stats.pendingLeaves} ${t('pending')}`,
        },
        {
            id: "payroll",
            title: t('payrollReport'),
            description: t('payrollReportDesc'),
            icon: <DollarSign className="h-5 w-5" />,
            color: "from-purple-500 to-pink-600",
            count: t('thisMonth'),
        },
    ]

    const reportPurposeCards = [
        { icon: Target, title: t('purposeDecisionTitle'), desc: t('purposeDecisionDesc') },
        { icon: Download, title: t('purposeExportTitle'), desc: t('purposeExportDesc') },
        { icon: ShieldCheck, title: t('purposeComplianceTitle'), desc: t('purposeComplianceDesc') },
    ]

    const attendanceDaily = attendanceData?.daily || {}
    const todayExceptions = (attendanceDaily.late || 0) + (attendanceDaily.absent || 0) + (attendanceDaily.half_day || 0) + (attendanceDaily["half-day"] || 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
                    <p className="text-muted-foreground mt-1 max-w-3xl">{t('subtitle')}</p>
                </div>
                <Button variant="outline" className="gap-2 self-start lg:self-auto" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-4 w-4" />
                    {t('refreshReports')}
                </Button>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-hover border-card-border">
                    <TabsTrigger value="overview">{t('overviewTab')}</TabsTrigger>
                    <TabsTrigger value="exports">{t('exportsTab')}</TabsTrigger>
                    <TabsTrigger value="attendance">{t('attendanceTab')}</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-card border-card-border">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('totalEmployees')}</p>
                                        <h3 className="text-2xl font-bold text-foreground">{stats.totalEmployees}</h3>
                                    </div>
                                    <div className="p-3 rounded-xl bg-linear-to-r from-blue-500 to-indigo-600">
                                        <Users className="h-5 w-5 text-foreground" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-card-border">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('activeEmployees')}</p>
                                        <h3 className="text-2xl font-bold text-foreground">{stats.activeEmployees}</h3>
                                    </div>
                                    <div className="p-3 rounded-xl bg-linear-to-r from-emerald-500 to-green-600">
                                        <TrendingUp className="h-5 w-5 text-foreground" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-card-border">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('avgAttendance')}</p>
                                        <h3 className="text-2xl font-bold text-foreground">{stats.avgAttendance}%</h3>
                                    </div>
                                    <div className="p-3 rounded-xl bg-linear-to-r from-amber-500 to-orange-600">
                                        <BarChart3 className="h-5 w-5 text-foreground" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-card-border">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('monthlyPayroll')}</p>
                                        <h3 className="text-2xl font-bold text-foreground">৳{stats.monthlyPayroll.toLocaleString() || "0"}</h3>
                                    </div>
                                    <div className="p-3 rounded-xl bg-linear-to-r from-purple-500 to-pink-600">
                                        <DollarSign className="h-5 w-5 text-foreground" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        {reportPurposeCards.map((item) => {
                            const Icon = item.icon
                            return (
                                <Card key={item.title} className="bg-card border-card-border">
                                    <CardContent className="p-5">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                                            <Icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>

                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-400" />
                                {t('todayActionSummary')}
                            </CardTitle>
                            <CardDescription>{t('todayActionSummaryDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-hover p-4">
                                <p className="text-sm text-muted-foreground">{t('present')}</p>
                                <p className="text-2xl font-bold text-emerald-400">{attendanceDaily.present || 0}</p>
                            </div>
                            <div className="rounded-xl bg-hover p-4">
                                <p className="text-sm text-muted-foreground">{t('late')}</p>
                                <p className="text-2xl font-bold text-amber-400">{attendanceDaily.late || 0}</p>
                            </div>
                            <div className="rounded-xl bg-hover p-4">
                                <p className="text-sm text-muted-foreground">{t('needsReview')}</p>
                                <p className="text-2xl font-bold text-red-400">{todayExceptions}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="exports" className="mt-4 space-y-6">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle>{t('exportControlTitle')}</CardTitle>
                            <CardDescription>{t('exportControlDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label>{t('month')}</Label>
                                <Input type="number" min="1" max="12" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('year')}</Label>
                                <Input type="number" min="2020" value={reportYear} onChange={(e) => setReportYear(e.target.value)} />
                            </div>
                            <div className="rounded-xl bg-hover p-4 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground">{t('exportScopeTitle')}</p>
                                <p className="mt-1">{t('exportScopeDesc')}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Report Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {reportCards.map((report) => (
                            <Card key={report.id} className="bg-card border-card-border overflow-hidden group hover:border-border-hover transition-all">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className={`p-3 rounded-xl bg-linear-to-r ${report.color}`}>
                                            {report.icon}
                                        </div>
                                        <Badge variant="secondary" className="text-xs">
                                            {report.count}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-foreground mt-4">{report.title}</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        {report.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                            onClick={() => handleExport(report.id, "excel")}
                                            disabled={!!exporting}
                                        >
                                            {exporting === `${report.id}-excel` ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                            )}
                                            Excel
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 border-card-border"
                                            onClick={() => handleExport(report.id, "csv")}
                                            disabled={!!exporting}
                                        >
                                            {exporting === `${report.id}-csv` ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <FileText className="h-4 w-4 mr-2" />
                                            )}
                                            CSV
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="attendance" className="mt-4 space-y-6">
                    {attendanceData ? (
                        <>
                            <AttendanceCharts
                                dailyData={attendanceData.daily || {}}
                                monthlyData={attendanceData.monthly || []}
                            />
                            <LateEarlyTable data={attendanceData.offenders || []} />
                        </>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-tertiary-foreground" />
                        </div>
                    ) : (
                        <Card className="bg-card border-card-border">
                            <CardContent className="py-12 text-center">
                                <Clock className="h-12 w-12 mx-auto text-muted-text mb-4" />
                                <p className="text-muted-foreground">{t('noAttendanceData')}</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
