"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { LateEarlyTable } from "@/components/reports/late-early-table"

interface ReportCard {
    id: string
    title: string
    description: string
    icon: React.ReactNode
    color: string
    count?: number | string
}

export default function ReportsPage() {
    const { addToast } = useToast()
    const [activeTab, setActiveTab] = useState("overview")
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState<string | null>(null)
    const [attendanceData, setAttendanceData] = useState<any>(null)
    const [stats, setStats] = useState({
        totalEmployees: 0,
        activeEmployees: 0,
        pendingLeaves: 0,
        avgAttendance: 95,
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
                    setStats(prev => ({
                        ...prev,
                        totalEmployees: data.total || data.employees?.length || 0,
                        activeEmployees: data.employees?.filter((e: any) => e.employmentStatus === "active").length || 0,
                    }))
                }

                if (attRes.ok) {
                    setAttendanceData(await attRes.json())
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
            let data: any[] = []
            let formattedData: any[] = []
            let filename = ""

            switch (reportType) {
                case "employees":
                    const empRes = await fetch("/api/employees?limit=1000")
                    if (!empRes.ok) throw new Error("Failed to fetch employees")
                    const empData = await empRes.json()
                    data = empData.employees || []
                    formattedData = formatEmployeeExport(data)
                    filename = `employees_report_${new Date().toISOString().split("T")[0]}`
                    break

                case "attendance":
                    const month = new Date().getMonth() + 1
                    const year = new Date().getFullYear()
                    const attRes = await fetch(`/api/attendance/reports?month=${month}&year=${year}`)
                    if (!attRes.ok) throw new Error("Failed to fetch attendance")
                    const attData = await attRes.json()
                    data = attData.records || attData || []
                    formattedData = formatAttendanceExport(Array.isArray(data) ? data : [])
                    filename = `attendance_report_${month}_${year}`
                    break

                case "leaves":
                    const leaveRes = await fetch("/api/leaves/applications")
                    if (!leaveRes.ok) throw new Error("Failed to fetch leaves")
                    const leaveData = await leaveRes.json()
                    data = Array.isArray(leaveData) ? leaveData : leaveData.applications || []
                    formattedData = formatLeaveExport(data)
                    filename = `leave_report_${new Date().toISOString().split("T")[0]}`
                    break

                case "payroll":
                    const payMonth = new Date().getMonth() + 1
                    const payYear = new Date().getFullYear()
                    const payRes = await fetch(`/api/payroll/process?month=${payMonth}&year=${payYear}`)
                    if (!payRes.ok) throw new Error("Failed to fetch payroll")
                    const payData = await payRes.json()
                    data = Array.isArray(payData) ? payData : payData.slips || []
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
            title: "Employee Report",
            description: "Complete list of all employees",
            icon: <Users className="h-5 w-5" />,
            color: "from-blue-500 to-indigo-600",
            count: stats.totalEmployees,
        },
        {
            id: "attendance",
            title: "Attendance Report",
            description: "Monthly attendance summary",
            icon: <Clock className="h-5 w-5" />,
            color: "from-emerald-500 to-green-600",
            count: "Current Month",
        },
        {
            id: "leaves",
            title: "Leave Report",
            description: "Leave applications overview",
            icon: <Calendar className="h-5 w-5" />,
            color: "from-amber-500 to-orange-600",
            count: `${stats.pendingLeaves} pending`,
        },
        {
            id: "payroll",
            title: "Payroll Report",
            description: "Monthly salary breakdown",
            icon: <DollarSign className="h-5 w-5" />,
            color: "from-purple-500 to-pink-600",
            count: "This Month",
        },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Reports & Analytics</h1>
                    <p className="text-white/60 mt-1">Generate and export HR reports</p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-white/5 border-white/10">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="exports">Export Reports</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-[#12121A] border-white/10">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-white/60">Total Employees</p>
                                        <h3 className="text-2xl font-bold text-white">{stats.totalEmployees}</h3>
                                    </div>
                                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600">
                                        <Users className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#12121A] border-white/10">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-white/60">Active Employees</p>
                                        <h3 className="text-2xl font-bold text-white">{stats.activeEmployees}</h3>
                                    </div>
                                    <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600">
                                        <TrendingUp className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#12121A] border-white/10">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-white/60">Avg Attendance</p>
                                        <h3 className="text-2xl font-bold text-white">{stats.avgAttendance}%</h3>
                                    </div>
                                    <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600">
                                        <BarChart3 className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#12121A] border-white/10">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-white/60">Monthly Payroll</p>
                                        <h3 className="text-2xl font-bold text-white">৳{stats.monthlyPayroll.toLocaleString() || "0"}</h3>
                                    </div>
                                    <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600">
                                        <DollarSign className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Attendance Charts */}
                    {attendanceData && (
                        <AttendanceCharts
                            dailyData={attendanceData.daily}
                            monthlyData={attendanceData.monthly}
                        />
                    )}
                </TabsContent>

                <TabsContent value="exports" className="mt-4">
                    {/* Report Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {reportCards.map((report) => (
                            <Card key={report.id} className="bg-[#12121A] border-white/10 overflow-hidden group hover:border-white/20 transition-all">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className={`p-3 rounded-xl bg-gradient-to-r ${report.color}`}>
                                            {report.icon}
                                        </div>
                                        <Badge variant="secondary" className="text-xs">
                                            {report.count}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-white mt-4">{report.title}</CardTitle>
                                    <CardDescription className="text-white/60">
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
                                            className="flex-1 border-white/10"
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

                    {/* Custom Report Builder (Future) */}
                    <Card className="bg-[#12121A] border-white/10 border-dashed mt-6">
                        <CardContent className="py-12 text-center">
                            <BarChart3 className="h-12 w-12 mx-auto text-white/20 mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">Custom Report Builder</h3>
                            <p className="text-white/40 mb-4">
                                Create custom reports with specific filters and date ranges
                            </p>
                            <Badge variant="secondary">Coming Soon</Badge>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="attendance" className="mt-4 space-y-6">
                    {attendanceData ? (
                        <>
                            <AttendanceCharts
                                dailyData={attendanceData.daily}
                                monthlyData={attendanceData.monthly}
                            />
                            <LateEarlyTable data={attendanceData.offenders} />
                        </>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
                        </div>
                    ) : (
                        <Card className="bg-[#12121A] border-white/10">
                            <CardContent className="py-12 text-center">
                                <Clock className="h-12 w-12 mx-auto text-white/20 mb-4" />
                                <p className="text-white/60">No attendance data available</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
