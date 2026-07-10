"use client"

import { useMemo } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, LeaveApplication } from "@/components/leaves/applications/columns"
import { LeaveBalanceCards } from "@/components/leaves/leave-balance-cards"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Calendar, RefreshCw, Clock, CheckCircle2, XCircle, FileStack, CalendarDays, Settings2, ArrowRight, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useLeaveApplications } from "@/hooks/use-data"

export default function LeaveApplicationsPage() {
    const t = useTranslations('Leaves')
    const locale = useLocale()
    const isBn = locale.startsWith('bn')

    // ── TanStack Query: leave applications ──
    const { data: applications = [], isLoading, error, refetch, isFetching } = useLeaveApplications()
    const data = applications as LeaveApplication[]

    // ── Derived statistics ──
    const stats = useMemo(() => {
        const pending = data.filter(d => d.status === 'pending').length
        const approved = data.filter(d => d.status === 'approved').length
        const rejected = data.filter(d => d.status === 'rejected').length
        const totalDaysApproved = data
            .filter(d => d.status === 'approved')
            .reduce((sum, d) => sum + (d.totalDays || 0), 0)
        return { pending, approved, rejected, total: data.length, totalDaysApproved }
    }, [data])

    const statsCards = [
        {
            label: t('pendingApproval'),
            value: stats.pending,
            icon: Clock,
            tint: 'bg-amber-500/15 text-amber-400',
            ring: 'border-amber-500/20',
        },
        {
            label: t('approved'),
            value: stats.approved,
            icon: CheckCircle2,
            tint: 'bg-emerald-500/15 text-emerald-400',
            ring: 'border-emerald-500/20',
        },
        {
            label: t('rejected'),
            value: stats.rejected,
            icon: XCircle,
            tint: 'bg-red-500/15 text-red-400',
            ring: 'border-red-500/20',
        },
        {
            label: t('totalApplications'),
            value: stats.total,
            icon: FileStack,
            tint: 'bg-blue-500/15 text-blue-400',
            ring: 'border-blue-500/20',
        },
    ]

    const quickActions = [
        {
            href: "/leaves/apply",
            icon: Plus,
            title: t('apply'),
            description: t('applySubtitle'),
            tint: 'from-blue-500/15 to-indigo-500/10',
            iconBg: 'bg-blue-500/20 text-blue-400',
            accent: 'text-blue-400',
        },
        {
            href: "/leaves/calendar",
            icon: CalendarDays,
            title: t('calendarTitle'),
            description: t('calendarSubtitle'),
            tint: 'from-emerald-500/15 to-teal-500/10',
            iconBg: 'bg-emerald-500/20 text-emerald-400',
            accent: 'text-emerald-400',
        },
        {
            href: "/leaves/types",
            icon: Settings2,
            title: t('typesTitle'),
            description: t('typesSubtitle'),
            tint: 'from-purple-500/15 to-fuchsia-500/10',
            iconBg: 'bg-purple-500/20 text-purple-400',
            accent: 'text-purple-400',
        },
    ]

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                        <Calendar className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t('title')}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {error && (
                        <Button variant="outline" onClick={() => refetch()} className="gap-2 border-card-border">
                            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                            {isBn ? "আবার চেষ্টা করুন" : "Retry"}
                        </Button>
                    )}
                    <Link href="/leaves/apply">
                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20">
                            <Plus className="h-4 w-4" />
                            {t('apply')}
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statsCards.map((stat, i) => (
                    <Card key={i} className={`border ${stat.ring} bg-card overflow-hidden`}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                                    <p className="text-2xl font-display font-bold text-foreground mt-1 tabular-nums">
                                        {isLoading ? <span className="text-muted-text">--</span> : stat.value}
                                    </p>
                                </div>
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.tint}`}>
                                    <stat.icon className="h-5 w-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickActions.map((action, i) => (
                    <Link key={i} href={action.href} className="block group">
                        <Card className="relative overflow-hidden border-card-border hover:border-blue-500/30 transition-all hover:shadow-md hover:shadow-blue-500/5">
                            <div className={`absolute inset-0 bg-linear-to-br ${action.tint} opacity-50 group-hover:opacity-100 transition-opacity`} />
                            <CardContent className="relative p-5">
                                <div className="flex items-start gap-4">
                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.iconBg} group-hover:scale-110 transition-transform`}>
                                        <action.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-foreground">{action.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{action.description}</p>
                                    </div>
                                    <ArrowRight className={`h-4 w-4 ${action.accent} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 mt-1`} />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Leave Balance Cards */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    <h2 className="text-sm font-semibold text-foreground">{t('leaveBalancesTitle')}</h2>
                </div>
                <LeaveBalanceCards />
            </div>

            {/* Applications Table */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <FileStack className="h-4 w-4 text-blue-400" />
                    <h2 className="text-sm font-semibold text-foreground">{t('requestsTitle')}</h2>
                </div>
                <DataTable
                    columns={columns}
                    data={data}
                    searchKey="employeeName"
                    placeholder={isBn ? "কর্মচারীর নাম দিয়ে খুঁজুন..." : "Search by employee name..."}
                    isLoading={isLoading}
                    emptyTitle={isBn ? "কোনো ছুটির আবেদন নেই" : "No leave applications"}
                    emptyDescription={isBn ? "দেখানোর মতো কোনো ছুটির আবেদন নেই। আবেদন জমা হলে এখানে দেখা যাবে।" : "There are no leave applications to display. Applications will appear here once submitted."}
                    emptyVariant="calendar"
                />
            </div>
        </div>
    )
}
