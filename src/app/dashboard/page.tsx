"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from 'next-intl';
import { useLocale as useNextIntlLocale } from "next-intl";
import { formatNumber } from "@/lib/i18n-utils";
import {
    Users,
    UserCheck,
    CalendarOff,
    Clock,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    Calendar,
    Banknote,
    AlertCircle,
    FileText,
    Receipt,
    Gift,
    Award,
    type LucideIcon,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════════

interface AnalyticsData {
    headcount: {
        total: number;
        newHires: number;
        separations: number;
        trend: { month: string; hires: number; separations: number }[];
    };
    departments: { name: string; count: number }[];
    attendance: Record<string, number>;
    leaves: { pending: number; onLeaveToday: number };
    payrollCost: { month: string; gross: number; net: number; headcount: number }[];
    upcoming: {
        birthdays: { name: string; department: string; date: string }[];
        anniversaries: { name: string; department: string; date: string; years: number }[];
    };
    pendingActions: { leaves: number; loans: number; expenses: number };
}

// ════════════════════════════════════════════════════════════════════════════════
// Stat Card
// ════════════════════════════════════════════════════════════════════════════════

function StatCard({
    title, value, change, changeType, Icon, color, glowClass = "", loading = false
}: {
    title: string; value: string; change: string;
    changeType: "positive" | "negative" | "neutral" | "warning";
    Icon: LucideIcon; color: string; glowClass?: string; loading?: boolean;
}) {
    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-12 w-12 rounded-xl" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
                        <div className="flex items-center gap-1 mt-2">
                            {changeType === "positive" && <TrendingUp className="h-4 w-4 text-emerald-400" />}
                            {changeType === "negative" && <TrendingDown className="h-4 w-4 text-red-400" />}
                            <span className={`text-sm ${changeType === "positive" ? "text-emerald-400"
                                : changeType === "negative" ? "text-red-400"
                                    : changeType === "warning" ? "text-amber-400"
                                        : "text-muted-foreground"
                                }`}>{change}</span>
                        </div>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${color} shadow-lg ${glowClass}`}>
                        <Icon className="h-6 w-6 text-foreground" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Mini Line Chart (SVG)
// ════════════════════════════════════════════════════════════════════════════════

function MiniLineChart({ data, color = "#3B82F6", height = 120 }: {
    data: { label: string; value: number }[];
    color?: string;
    height?: number;
}) {
    if (!data.length) return null;

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const w = 100;
    const h = height;
    const padding = 10;
    const chartW = w - padding * 2;
    const chartH = h - padding * 2;

    const points = data.map((d, i) => ({
        x: padding + (i / Math.max(data.length - 1, 1)) * chartW,
        y: padding + chartH - (d.value / maxVal) * chartH,
    }));

    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const areaD = `${pathD} L${points[points.length - 1].x},${h - padding} L${points[0].x},${h - padding} Z`;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
            <defs>
                <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />
            <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} />
            ))}
        </svg>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Mini Bar Chart (SVG)
// ════════════════════════════════════════════════════════════════════════════════

function MiniBarChart({ data, height = 140 }: {
    data: { label: string; gross: number; net: number }[];
    height?: number;
}) {
    if (!data.length) return null;

    const maxVal = Math.max(...data.map(d => d.gross), 1);
    const barWidth = 100 / data.length;
    const gap = barWidth * 0.15;

    return (
        <div>
            <svg viewBox="0 0 100 100" className="w-full" style={{ height }} preserveAspectRatio="none">
                {data.map((d, i) => {
                    const x = i * barWidth + gap;
                    const w = barWidth - gap * 2;
                    const grossH = (d.gross / maxVal) * 85;
                    const netH = (d.net / maxVal) * 85;
                    return (
                        <g key={i}>
                            <rect x={x} y={100 - grossH} width={w} height={grossH} rx="1" fill="#3B82F6" opacity="0.3" />
                            <rect x={x + w * 0.15} y={100 - netH} width={w * 0.7} height={netH} rx="1" fill="#3B82F6" opacity="0.8" />
                        </g>
                    );
                })}
            </svg>
            <div className="flex justify-between mt-2 px-1">
                {data.map((d, i) => (
                    <span key={i} className="text-[10px] text-tertiary-foreground">{d.label.split(' ')[0]}</span>
                ))}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Donut Chart (SVG)
// ════════════════════════════════════════════════════════════════════════════════

const DONUT_COLORS = [
    "#3B82F6", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B",
    "#EF4444", "#EC4899", "#6366F1", "#14B8A6", "#F97316",
];

function DonutChart({ data, size = 160, totalLabel = "Total" }: {
    data: { name: string; count: number }[];
    size?: number;
    totalLabel?: string;
}) {
    const total = data.reduce((s, d) => s + d.count, 0);
    if (total === 0) return null;

    const radius = 35;
    const stroke = 10;
    const cx = 50;
    const cy = 50;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;
    const segments = data.filter(d => d.count > 0).map((d, i) => {
        const pct = d.count / total;
        const dashLen = circumference * pct;
        const segment = { ...d, color: DONUT_COLORS[i % DONUT_COLORS.length], dashLen, offset, pct };
        offset += dashLen;
        return segment;
    });

    return (
        <div className="flex items-center gap-4">
            <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
                {segments.map((seg, i) => (
                    <circle
                        key={i}
                        cx={cx} cy={cy} r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={stroke}
                        strokeDasharray={`${seg.dashLen} ${circumference - seg.dashLen}`}
                        strokeDashoffset={-seg.offset}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${cx} ${cy})`}
                        className="transition-all duration-500"
                    />
                ))}
                <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground text-[10px] font-bold">{total}</text>
                <text x={cx} y={cy + 8} textAnchor="middle" className="fill-muted-foreground text-[5px]">{totalLabel}</text>
            </svg>
            <div className="flex-1 space-y-1.5 max-h-40 overflow-y-auto">
                {segments.map((seg, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                            <span className="text-xs text-muted-foreground truncate">{seg.name}</span>
                        </div>
                        <span className="text-xs font-medium text-foreground">{seg.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Attendance Ring
// ════════════════════════════════════════════════════════════════════════════════

function AttendanceRing({ data, total, labels }: {
    data: Record<string, number>;
    total: number;
    labels: { present: string; late: string; absent: string; onLeave: string; notCheckedIn: string; attendance: string };
}) {
    const present = (data.present || 0) + (data.late || 0);
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const fill = (pct / 100) * circumference;

    const items = [
        { label: labels.present, value: data.present || 0, color: "#10B981" },
        { label: labels.late, value: data.late || 0, color: "#F59E0B" },
        { label: labels.absent, value: data.absent || 0, color: "#EF4444" },
        { label: labels.onLeave, value: data.on_leave || 0, color: "#8B5CF6" },
        { label: labels.notCheckedIn, value: data.notCheckedIn || 0, color: "#6B7280" },
    ];

    return (
        <div className="flex items-center gap-6">
            <svg viewBox="0 0 100 100" style={{ width: 130, height: 130 }}>
                <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                    cx="50" cy="50" r={radius} fill="none"
                    stroke="#10B981" strokeWidth="8"
                    strokeDasharray={`${fill} ${circumference - fill}`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    className="transition-all duration-1000"
                />
                <text x="50" y="46" textAnchor="middle" className="fill-foreground text-[14px] font-bold">{pct}%</text>
                <text x="50" y="58" textAnchor="middle" className="fill-muted-foreground text-[5px]">{labels.attendance}</text>
            </svg>
            <div className="flex-1 space-y-2">
                {items.filter(i => i.value > 0).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                            <span className="text-xs text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Main Dashboard
// ════════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
    const { data: session } = useSession();
    const locale = useNextIntlLocale();
    const t = useTranslations('Dashboard');
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const res = await fetch("/api/dashboard/analytics");
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data);
            }
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('goodMorning');
        if (hour < 17) return t('goodAfternoon');
        return t('goodEvening');
    };

    const userName = session?.user?.name || "Admin";

    const stats = analytics ? [
        {
            title: t('totalEmployees'),
            value: formatNumber(analytics.headcount.total, locale),
            change: t('newThisMonth', { count: formatNumber(analytics.headcount.newHires, locale) }),
            changeType: analytics.headcount.newHires > 0 ? "positive" as const : "neutral" as const,
            Icon: Users,
            color: "from-blue-500 to-blue-600",
            glowClass: "icon-glow-blue"
        },
        {
            title: t('presentToday'),
            value: formatNumber(analytics.attendance.present || 0, locale),
            change: `${analytics.headcount.total > 0 ? Math.round(((analytics.attendance.present || 0) / analytics.headcount.total) * 100) : 0}%`,
            changeType: "neutral" as const,
            Icon: UserCheck,
            color: "from-emerald-500 to-emerald-600",
            glowClass: "icon-glow-green"
        },
        {
            title: t('onLeave'),
            value: formatNumber(analytics.leaves.onLeaveToday, locale),
            change: t('today'),
            changeType: "negative" as const,
            Icon: CalendarOff,
            color: "from-amber-500 to-amber-600",
            glowClass: "icon-glow-red"
        },
        {
            title: t('pendingRequests'),
            value: formatNumber(
                analytics.pendingActions.leaves + analytics.pendingActions.loans + analytics.pendingActions.expenses,
                locale
            ),
            change: t('awaitingApproval'),
            changeType: "warning" as const,
            Icon: Clock,
            color: "from-purple-500 to-purple-600",
            glowClass: "icon-glow-orange"
        },
    ] : [];

    const quickActions = [
        { label: t('markAttendance'), icon: Clock, color: "bg-blue-500/20 text-blue-400", href: "/attendance" },
        { label: t('applyLeave'), icon: CalendarOff, color: "bg-emerald-500/20 text-emerald-400", href: "/leaves/apply" },
        { label: t('runPayroll'), icon: Banknote, color: "bg-purple-500/20 text-purple-400", href: "/payroll" },
        { label: t('addEmployeeAction'), icon: Users, color: "bg-amber-500/20 text-amber-400", href: "/employees/new" },
        { label: t('viewReports'), icon: TrendingUp, color: "bg-cyan-500/20 text-cyan-400", href: "/reports" },
        { label: t('leavesAction'), icon: AlertCircle, color: "bg-pink-500/20 text-pink-400", href: "/leaves" },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Welcome Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{getGreeting()}, {userName}</h1>
                        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/leaves/calendar">
                            <Button variant="outline" className="gap-2">
                                <Calendar className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('viewCalendar')}</span>
                            </Button>
                        </Link>
                        <Link href="/employees/new">
                            <Button className="gap-2">
                                <Users className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('addEmployee')}</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className={`animate-card-enter animate-card-enter-${i + 1}`}>
                                <StatCard title="" value="" change="" changeType="neutral" Icon={Users} color="" loading />
                            </div>
                        ))
                    ) : (
                        stats.map((stat, i) => (
                            <div key={stat.title} className={`animate-card-enter animate-card-enter-${i + 1}`}>
                                <StatCard {...stat} />
                            </div>
                        ))
                    )}
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Headcount Trend */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{t('headcountTrend')}</CardTitle>
                                <Badge variant="default">{t('months12')}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-[140px] w-full rounded-lg" />
                            ) : analytics?.headcount.trend ? (
                                <div>
                                    <div className="flex gap-4 mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-2 w-2 rounded-full bg-emerald-400" />
                                            <span className="text-xs text-muted-foreground">{t('hires')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-2 w-2 rounded-full bg-red-400" />
                                            <span className="text-xs text-muted-foreground">{t('separations')}</span>
                                        </div>
                                    </div>
                                    <MiniLineChart
                                        data={analytics.headcount.trend.map(t => ({
                                            label: t.month,
                                            value: t.hires,
                                        }))}
                                        color="#10B981"
                                        height={140}
                                    />
                                    <div className="flex justify-between mt-2 px-1">
                                        {analytics.headcount.trend.filter((_, i) => i % 3 === 0).map((t, i) => (
                                            <span key={i} className="text-[10px] text-tertiary-foreground">{t.month.split(' ')[0]}</span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">{t('noDataAvailable')}</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Today's Attendance Ring */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('todaysAttendance')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-[130px] w-full rounded-lg" />
                            ) : analytics ? (
                                <AttendanceRing
                                    data={analytics.attendance}
                                    total={analytics.headcount.total}
                                    labels={{
                                        present: t('present'),
                                        late: t('late'),
                                        absent: t('absent'),
                                        onLeave: t('onLeaveLabel'),
                                        notCheckedIn: t('notCheckedIn'),
                                        attendance: t('attendance'),
                                    }}
                                />
                            ) : null}
                        </CardContent>
                    </Card>
                </div>

                {/* Second Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Payroll Cost Trend */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{t('payrollCostTrend')}</CardTitle>
                                <Badge variant="default">{t('months6')}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-[160px] w-full rounded-lg" />
                            ) : analytics?.payrollCost ? (
                                <div>
                                    <div className="flex gap-4 mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-2 w-2 rounded-full bg-blue-400 opacity-30" />
                                            <span className="text-xs text-muted-foreground">{t('gross')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-2 w-2 rounded-full bg-blue-400" />
                                            <span className="text-xs text-muted-foreground">{t('net')}</span>
                                        </div>
                                    </div>
                                    <MiniBarChart
                                        data={analytics.payrollCost.map(p => ({
                                            label: p.month,
                                            gross: p.gross,
                                            net: p.net,
                                        }))}
                                        height={140}
                                    />
                                </div>
                            ) : (
                                <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">{t('noPayrollData')}</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Department Distribution */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('departmentDistribution')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-[160px] w-full rounded-lg" />
                            ) : analytics?.departments && analytics.departments.length > 0 ? (
                                <DonutChart data={analytics.departments} size={140} totalLabel={t('total')} />
                            ) : (
                                <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">{t('noDepartments')}</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Upcoming + Pending */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Upcoming Birthdays & Anniversaries */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Gift className="h-5 w-5 text-pink-400" />
                                    {t('upcomingEventsTitle')}
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {analytics?.upcoming.birthdays.map((b, i) => (
                                        <div key={`b-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-hover hover:bg-card transition-colors">
                                            <div className="h-9 w-9 rounded-lg bg-pink-500/20 flex items-center justify-center">
                                                <Gift className="h-4 w-4 text-pink-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                                                <p className="text-xs text-muted-foreground">{b.department} • {t('birthday')}</p>
                                            </div>
                                            <Badge variant="default">{b.date}</Badge>
                                        </div>
                                    ))}
                                    {analytics?.upcoming.anniversaries.map((a, i) => (
                                        <div key={`a-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-hover hover:bg-card transition-colors">
                                            <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                                <Award className="h-4 w-4 text-amber-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                                                <p className="text-xs text-muted-foreground">{a.department} • {t('yearAnniversary', { years: a.years })}</p>
                                            </div>
                                            <Badge variant="default">{a.date}</Badge>
                                        </div>
                                    ))}
                                    {(!analytics?.upcoming.birthdays.length && !analytics?.upcoming.anniversaries.length) && (
                                        <div className="text-center py-8">
                                            <Calendar className="h-8 w-8 text-tertiary-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">{t('noUpcomingEvents30')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pending Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-amber-400" />
                                {t('pendingActions')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                                    ))}
                                </div>
                            ) : analytics ? (
                                <div className="space-y-3">
                                    <Link href="/leaves/requests">
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-hover hover:bg-card hover:-translate-y-0.5 transition-all cursor-pointer">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                                    <CalendarOff className="h-4 w-4 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{t('leaveRequests')}</p>
                                                    <p className="text-xs text-muted-foreground">{t('awaitingApprovalLabel')}</p>
                                                </div>
                                            </div>
                                            <Badge variant="warning" dot>{analytics.pendingActions.leaves}</Badge>
                                        </div>
                                    </Link>
                                    <Link href="/expenses">
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-hover hover:bg-card hover:-translate-y-0.5 transition-all cursor-pointer">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                                    <Receipt className="h-4 w-4 text-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{t('expenseClaims')}</p>
                                                    <p className="text-xs text-muted-foreground">{t('pendingReview')}</p>
                                                </div>
                                            </div>
                                            <Badge variant="warning" dot>{analytics.pendingActions.expenses}</Badge>
                                        </div>
                                    </Link>
                                    <Link href="/payroll">
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-hover hover:bg-card hover:-translate-y-0.5 transition-all cursor-pointer">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                    <Banknote className="h-4 w-4 text-purple-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{t('loanRequests')}</p>
                                                    <p className="text-xs text-muted-foreground">{t('pendingApprovalAction')}</p>
                                                </div>
                                            </div>
                                            <Badge variant="warning" dot>{analytics.pendingActions.loans}</Badge>
                                        </div>
                                    </Link>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('quickActions')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                            {quickActions.map((action) => (
                                <Link key={action.label} href={action.href}>
                                    <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-hover hover:bg-card border border-card-border hover:border-border hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer">
                                        <div className={`h-12 w-12 rounded-xl ${action.color} flex items-center justify-center`}>
                                            <action.icon className="h-6 w-6" />
                                        </div>
                                        <span className="text-sm font-medium text-muted-foreground">{action.label}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
