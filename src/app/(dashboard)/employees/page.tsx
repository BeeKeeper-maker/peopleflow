"use client"

import { useEffect, useState, useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns } from "./columns"
import { Employee } from "@/types/employee"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    Users,
    RefreshCw,
    UserCheck,
    UserMinus,
    Shield,
    TrendingUp,
    Building2,
    Briefcase,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useToast } from "@/components/ui/toast"

// ════════════════════════════════════════════════════════════════════════
// Animated Counter
// ════════════════════════════════════════════════════════════════════════

function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (target === 0) { setCount(0); return }
        let start = 0
        const step = Math.max(1, Math.ceil(target / (duration / 16)))
        const timer = setInterval(() => {
            start += step
            if (start >= target) {
                setCount(target)
                clearInterval(timer)
            } else {
                setCount(start)
            }
        }, 16)
        return () => clearInterval(timer)
    }, [target, duration])

    return <>{count}</>
}

// ════════════════════════════════════════════════════════════════════════
// Stat Card — Glassmorphic with glow
// ════════════════════════════════════════════════════════════════════════

function StatCard({ title, value, Icon, color, glowColor, subtitle }: {
    title: string; value: number; Icon: React.ElementType;
    color: string; glowColor: string; subtitle?: string;
}) {
    return (
        <Card className="relative overflow-hidden group hover:border-border transition-all duration-300 hover:-translate-y-0.5">
            {/* Glow Effect */}
            <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full ${glowColor} opacity-20 blur-3xl group-hover:opacity-40 transition-opacity duration-500`} />
            <CardContent className="p-5 relative">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                        <p className="text-3xl font-bold text-foreground tabular-nums">
                            <AnimatedCounter target={value} />
                        </p>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                        )}
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br ${color} shadow-lg`}>
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// ════════════════════════════════════════════════════════════════════════
// Mini Department Bar
// ════════════════════════════════════════════════════════════════════════

function DepartmentBar({ departments }: { departments: { name: string; count: number }[] }) {
    const max = Math.max(...departments.map(d => d.count), 1)
    const colors = [
        "from-blue-500 to-blue-600",
        "from-purple-500 to-purple-600",
        "from-cyan-500 to-cyan-600",
        "from-emerald-500 to-emerald-600",
        "from-amber-500 to-amber-600",
        "from-pink-500 to-pink-600",
        "from-indigo-500 to-indigo-600",
        "from-teal-500 to-teal-600",
    ]

    return (
        <div className="space-y-3">
            {departments.slice(0, 6).map((dept, i) => (
                <div key={dept.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            {dept.name}
                        </span>
                        <span className="text-xs font-bold text-foreground tabular-nums">{dept.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-hover overflow-hidden">
                        <div
                            className={`h-full rounded-full bg-linear-to-r ${colors[i % colors.length]} transition-all duration-700 ease-out`}
                            style={{ width: `${(dept.count / max) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════

export default function EmployeesPage() {
    const [data, setData] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const t = useTranslations('Employees')
    const { addToast } = useToast()

    const fetchData = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const response = await fetch("/api/employees?limit=5000")
            if (response.ok) {
                const result = await response.json()
                setData(result.data || result || [])
            } else {
                const errData = await response.json().catch(() => ({}))
                const msg = errData.error || "Failed to load employees"
                setError(msg)
                addToast({ title: "Error", description: msg, type: "error" })
            }
        } catch {
            const msg = "Network error. Please check your connection."
            setError(msg)
            addToast({ title: "Connection Error", description: msg, type: "error" })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // ── Computed Stats ──────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = data.length
        const active = data.filter(e => (e as any).employmentStatus === "active").length
        const probation = data.filter(e => (e as any).employmentType === "probation").length

        // Department distribution
        const deptMap = new Map<string, number>()
        data.forEach(e => {
            const dept = (e as any).department?.name || (e as any).departmentName || "Unassigned"
            deptMap.set(dept, (deptMap.get(dept) || 0) + 1)
        })
        const departments = [...deptMap.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)

        // Gender distribution
        const male = data.filter(e => (e as any).gender === "male").length
        const female = data.filter(e => (e as any).gender === "female").length

        // Employment types
        const permanent = data.filter(e => (e as any).employmentType === "permanent").length
        const contractual = data.filter(e => (e as any).employmentType === "contractual").length
        const intern = data.filter(e => (e as any).employmentType === "intern").length

        return { total, active, probation, departments, male, female, permanent, contractual, intern }
    }, [data])

    return (
        <div className="space-y-6">
            {/* ── Hero Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
                        <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('title')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('subtitle')}
                            {!isLoading && (
                                <Badge variant="default" className="ml-2">
                                    {stats.total} {stats.total === 1 ? "record" : "records"}
                                </Badge>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {error && (
                        <Button variant="outline" onClick={fetchData} className="gap-2 border-card-border">
                            <RefreshCw className="h-4 w-4" />
                            Retry
                        </Button>
                    )}
                    <Button variant="outline" onClick={fetchData} disabled={isLoading} className="gap-2 border-card-border hover:border-border">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">{t('refresh') || 'Refresh'}</span>
                    </Button>
                    <Link href="/employees/new">
                        <Button className="gap-2 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all">
                            <Plus className="h-4 w-4" />
                            {t('addNew')}
                        </Button>
                    </Link>
                </div>
            </div>

            {/* ── Glassmorphic Stats Row ────────────────────────────── */}
            {!isLoading && data.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title={t('totalEmployees') || 'Total Employees'}
                        value={stats.total}
                        Icon={Users}
                        color="from-blue-500 to-blue-600"
                        glowColor="bg-blue-500"
                    />
                    <StatCard
                        title={t('activeEmployees') || 'Active'}
                        value={stats.active || stats.total}
                        Icon={UserCheck}
                        color="from-emerald-500 to-emerald-600"
                        glowColor="bg-emerald-500"
                        subtitle={stats.total > 0 ? `${Math.round(((stats.active || stats.total) / stats.total) * 100)}% of workforce` : undefined}
                    />
                    <StatCard
                        title={t('onProbation') || 'Probation'}
                        value={stats.probation}
                        Icon={Shield}
                        color="from-amber-500 to-amber-600"
                        glowColor="bg-amber-500"
                        subtitle={stats.probation > 0 ? "Pending confirmation" : "All confirmed"}
                    />
                    <StatCard
                        title={t('departments') || 'Departments'}
                        value={stats.departments.length}
                        Icon={Building2}
                        color="from-purple-500 to-purple-600"
                        glowColor="bg-purple-500"
                        subtitle="Active departments"
                    />
                </div>
            )}

            {/* ── Workforce Insights Row ────────────────────────────── */}
            {!isLoading && data.length > 0 && stats.departments.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Department Distribution */}
                    <Card className="lg:col-span-2">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-blue-400" />
                                    <h3 className="text-sm font-semibold text-foreground">{t('departmentDistribution') || 'Department Distribution'}</h3>
                                </div>
                                <Badge variant="default" className="text-[10px]">
                                    {stats.departments.length} depts
                                </Badge>
                            </div>
                            <DepartmentBar departments={stats.departments} />
                        </CardContent>
                    </Card>

                    {/* Workforce Composition */}
                    <Card>
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-5">
                                <Briefcase className="h-4 w-4 text-purple-400" />
                                <h3 className="text-sm font-semibold text-foreground">{t('workforceComposition') || 'Workforce'}</h3>
                            </div>
                            <div className="space-y-4">
                                {/* Employment Type Breakdown */}
                                <div className="space-y-3">
                                    {[
                                        { label: t('permanent') || "Permanent", count: stats.permanent, color: "bg-emerald-400" },
                                        { label: t('contractual') || "Contractual", count: stats.contractual, color: "bg-blue-400" },
                                        { label: t('probation') || "Probation", count: stats.probation, color: "bg-amber-400" },
                                        { label: t('intern') || "Intern", count: stats.intern, color: "bg-purple-400" },
                                    ].filter(i => i.count > 0).map(item => (
                                        <div key={item.label} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2 w-2 rounded-full ${item.color}`} />
                                                <span className="text-xs text-muted-foreground">{item.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-foreground tabular-nums">{item.count}</span>
                                                <span className="text-[10px] text-tertiary-foreground">
                                                    ({stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0}%)
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Gender */}
                                {(stats.male > 0 || stats.female > 0) && (
                                    <>
                                        <div className="border-t border-card-border pt-3">
                                            <p className="text-[10px] uppercase tracking-wider text-tertiary-foreground mb-2">
                                                {t('genderDistribution') || 'Gender'}
                                            </p>
                                            <div className="flex gap-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-blue-400" />
                                                    <span className="text-xs text-muted-foreground">Male</span>
                                                    <span className="text-xs font-bold text-foreground">{stats.male}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-pink-400" />
                                                    <span className="text-xs text-muted-foreground">Female</span>
                                                    <span className="text-xs font-bold text-foreground">{stats.female}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Gender bar */}
                                        <div className="h-2 rounded-full bg-hover overflow-hidden flex">
                                            <div
                                                className="h-full bg-linear-to-r from-blue-500 to-blue-400 transition-all duration-700"
                                                style={{ width: `${(stats.male / (stats.male + stats.female)) * 100}%` }}
                                            />
                                            <div
                                                className="h-full bg-linear-to-r from-pink-400 to-pink-500 transition-all duration-700"
                                                style={{ width: `${(stats.female / (stats.male + stats.female)) * 100}%` }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── DataTable ────────────────────────────────────────── */}
            <DataTable
                columns={columns}
                data={data}
                searchKey="name"
                placeholder={t('searchPlaceholder')}
                isLoading={isLoading}
                emptyTitle={t('noEmployees') || "No employees found"}
                emptyDescription={t('noEmployeesDesc') || "Start building your team by adding your first employee."}
                emptyVariant="employees"
                addLabel={t('addNew')}
                onAdd={() => window.location.href = "/employees/new"}
            />
        </div>
    )
}
