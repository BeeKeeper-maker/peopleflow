"use client"

import { Card } from "@/components/ui/card"
import { Clock, Calendar, Award, Briefcase } from "lucide-react"

interface ProfileStatsProps {
    joiningDate: Date
}

export function ProfileStats({ joiningDate }: ProfileStatsProps) {
    // Calculate years of service
    const serviceYears = (new Date().getFullYear() - new Date(joiningDate).getFullYear()).toFixed(1)

    const stats = [
        {
            label: "Attendance Rate",
            value: "98%",
            subtext: "Last 30 days",
            icon: Clock,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
        },
        {
            label: "Leave Balance",
            value: "12 Days",
            subtext: "Annual Leave",
            icon: Calendar,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
        },
        {
            label: "Service Period",
            value: `${serviceYears} Years`,
            subtext: "Since Joining",
            icon: Briefcase,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
        },
        {
            label: "Performance",
            value: "4.8/5",
            subtext: "Last Review",
            icon: Award,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
        },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm flex items-center gap-4 hover:bg-white/10 transition-colors">
                    <div className={`h-12 w-12 rounded-lg ${stat.bg} flex items-center justify-center`}>
                        <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div>
                        <p className="text-sm text-white/60">{stat.label}</p>
                        <h4 className="text-xl font-bold text-white">{stat.value}</h4>
                        <p className="text-xs text-white/40">{stat.subtext}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
