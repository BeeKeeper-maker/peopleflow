"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, Calendar, Briefcase, Award, TrendingUp, Wallet } from "lucide-react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ProfileStatsProps {
    employee: any
    apiBasePath?: string // Override for platform admin context
}

export function ProfileStats({ employee, apiBasePath }: ProfileStatsProps) {
    const [profileData, setProfileData] = useState<any>(null)

    useEffect(() => {
        const basePath = apiBasePath || "/api/employees"
        fetch(`${basePath}/${employee.id}/profile-data`)
            .then((res) => res.json())
            .then(setProfileData)
            .catch(console.error)
    }, [employee.id, apiBasePath])

    // Calculate years of service
    const servicePeriod = useMemo(() => {
        if (!employee.joiningDate) return "N/A"
        const joinDate = new Date(employee.joiningDate)
        const now = new Date()
        const years = now.getFullYear() - joinDate.getFullYear()
        const months = now.getMonth() - joinDate.getMonth()
        const totalMonths = years * 12 + months
        if (totalMonths < 12) return `${totalMonths}m`
        return `${Math.floor(totalMonths / 12)}y ${totalMonths % 12}m`
    }, [employee.joiningDate])

    const attendanceRate = profileData?.attendance?.rate ?? "—"
    const leaveRemaining = profileData?.leave?.totalRemaining ?? "—"
    const currentSalary = employee.salaryAssignments?.[0]

    const stats = [
        {
            label: "Attendance Rate",
            value: typeof attendanceRate === "number" ? `${attendanceRate}%` : attendanceRate,
            subtext: "Last 30 days",
            icon: Clock,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/15",
        },
        {
            label: "Leave Balance",
            value: typeof leaveRemaining === "number" ? `${leaveRemaining}d` : leaveRemaining,
            subtext: "Remaining this year",
            icon: Calendar,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/15",
        },
        {
            label: "Service Period",
            value: servicePeriod,
            subtext: "Since joining",
            icon: Briefcase,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            border: "border-purple-500/15",
        },
        {
            label: "Monthly Salary",
            value: currentSalary ? `৳${(currentSalary.grossSalary / 1000).toFixed(0)}k` : "—",
            subtext: currentSalary?.salaryStructure?.name || "Not assigned",
            icon: Wallet,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/15",
        },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
                <div
                    key={index}
                    className={`rounded-xl border ${stat.border} ${stat.bg} p-4 backdrop-blur-sm flex items-center gap-4 hover:scale-[1.02] transition-all duration-300`}
                >
                    <div className={`h-11 w-11 rounded-lg bg-white/5 flex items-center justify-center`}>
                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                        <h4 className={`text-xl font-bold ${stat.color}`}>{stat.value}</h4>
                        <p className="text-[10px] text-muted-foreground truncate">{stat.subtext}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
