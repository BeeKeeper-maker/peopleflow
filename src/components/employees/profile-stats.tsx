"use client"

import { useTranslations } from "next-intl"
import { Card } from "@/components/ui/card"
import { Clock, Calendar, Award, Briefcase } from "lucide-react"

interface ProfileStatsProps {
    joiningDate: Date
}

export function ProfileStats({ joiningDate }: ProfileStatsProps) {
    const t = useTranslations("SharedComponents.profileStats")

    // Calculate years of service
    const serviceYears = (new Date().getFullYear() - new Date(joiningDate).getFullYear()).toFixed(1)

    const stats = [
        {
            label: t("attendanceRate"),
            value: "98%",
            subtext: t("last30Days"),
            icon: Clock,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
        },
        {
            label: t("leaveBalance"),
            value: t("days", { count: 12 }),
            subtext: t("annualLeave"),
            icon: Calendar,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
        },
        {
            label: t("servicePeriod"),
            value: t("years", { count: serviceYears }),
            subtext: t("sinceJoining"),
            icon: Briefcase,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
        },
        {
            label: t("performance"),
            value: "4.8/5",
            subtext: t("lastReview"),
            icon: Award,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
        },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => (
                <div key={index} className="rounded-xl border border-card-border bg-hover p-4 backdrop-blur-sm flex items-center gap-4 hover:bg-hover transition-colors">
                    <div className={`h-12 w-12 rounded-lg ${stat.bg} flex items-center justify-center`}>
                        <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <h4 className="text-xl font-bold text-foreground">{stat.value}</h4>
                        <p className="text-xs text-tertiary-foreground">{stat.subtext}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
