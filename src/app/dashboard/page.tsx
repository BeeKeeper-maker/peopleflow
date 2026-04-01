"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    Briefcase,
    Shield,
    Activity,
    BarChart3,
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
// Animated Counter
// ════════════════════════════════════════════════════════════════════════════════

function AnimatedCounter({ target, suffix = "", duration = 1200 }: {
    target: number; suffix?: string; duration?: number;
}) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (target === 0) { setCount(0); return; }
        let start = 0;
        const step = Math.max(1, Math.ceil(target / (duration / 16)));
        const timer = setInterval(() => {
            start += step;
            if (start >= target) { setCount(target); clearInterval(timer); }
            else setCount(start);
        }, 16);
        return () => clearInterval(timer);
    }, [target, duration]);
    return <>{count.toLocaleString()}{suffix}</>;
}

// ════════════════════════════════════════════════════════════════════════════════
// Sparkline (Tiny inline chart)
// ════════════════════════════════════════════════════════════════════════════════

function Sparkline({ data, color = "#3B82F6", width = 80, height = 28 }: {
    data: number[]; color?: string; width?: number; height?: number;
}) {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pts = data.map((v, i) => ({
        x: (i / (data.length - 1)) * width,
        y: height - ((v - min) / range) * (height - 4) - 2,
    }));
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${d} L${width},${height} L0,${height} Z`;

    return (
        <svg width={width} height={height} className="shrink-0">
            <defs>
                <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#spark-${color.replace('#', '')})`} />
            <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2" fill={color} />
        </svg>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Pulse Card (Bento stat tile with sparkline)
// ════════════════════════════════════════════════════════════════════════════════

function PulseCard({ title, value, change, changeType, Icon, gradient, glow, sparkData, sparkColor, loading }: {
    title: string; value: string; change: string;
    changeType: "positive" | "negative" | "neutral" | "warning";
    Icon: LucideIcon; gradient: string; glow: string;
    sparkData?: number[]; sparkColor?: string; loading?: boolean;
}) {
    if (loading) {
        return (
            <Card className="relative overflow-hidden">
                <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-7 w-16" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-10 w-10 rounded-xl" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="relative overflow-hidden group hover:border-border transition-all duration-300 hover:-translate-y-0.5">
            <div className={`absolute -top-10 -right-10 h-28 w-28 rounded-full ${glow} opacity-15 blur-3xl group-hover:opacity-30 transition-opacity duration-500`} />
            <CardContent className="p-4 relative">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
                        <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{value}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            {changeType === "positive" && <TrendingUp className="h-3 w-3 text-emerald-400 shrink-0" />}
                            {changeType === "negative" && <TrendingDown className="h-3 w-3 text-red-400 shrink-0" />}
                            {changeType === "warning" && <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />}
                            <span className={`text-[11px] font-medium ${
                                changeType === "positive" ? "text-emerald-400"
                                    : changeType === "negative" ? "text-red-400"
                                        : changeType === "warning" ? "text-amber-400"
                                            : "text-muted-foreground"
                            }`}>{change}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br ${gradient} shadow-lg shrink-0`}>
                            <Icon className="h-5 w-5 text-white" />
                        </div>
                        {sparkData && sparkData.length > 1 && (
                            <Sparkline data={sparkData} color={sparkColor || "#3B82F6"} />
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Attendance Ring (compact)
// ════════════════════════════════════════════════════════════════════════════════

function AttendanceRingCompact({ data, total, labels }: {
    data: Record<string, number>; total: number;
    labels: Record<string, string>;
}) {
    const present = (data.present || 0) + (data.late || 0);
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    const r = 36;
    const circ = 2 * Math.PI * r;
    const fill = (pct / 100) * circ;

    const items = [
        { key: "present", color: "#10B981" },
        { key: "late", color: "#F59E0B" },
        { key: "absent", color: "#EF4444" },
        { key: "on_leave", color: "#8B5CF6" },
        { key: "notCheckedIn", color: "#475569" },
    ];

    return (
        <div className="flex items-center gap-5">
            <div className="relative shrink-0">
                <svg viewBox="0 0 100 100" width={100} height={100}>
                    <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                    <circle
                        cx="50" cy="50" r={r} fill="none"
                        stroke="#10B981" strokeWidth="7"
                        strokeDasharray={`${fill} ${circ - fill}`}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                        className="transition-all duration-1000"
                    />
                    <text x="50" y="47" textAnchor="middle" className="fill-foreground text-[13px] font-bold">{pct}%</text>
                    <text x="50" y="60" textAnchor="middle" className="fill-muted-foreground text-[6px] uppercase tracking-wider">{labels.attendance || "Rate"}</text>
                </svg>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {items.map(item => {
                    const val = item.key === "on_leave" ? (data.on_leave || 0) : (data[item.key] || 0);
                    if (val === 0 && item.key !== "present") return null;
                    const label = item.key === "on_leave" ? labels.onLeave :
                        item.key === "notCheckedIn" ? labels.notCheckedIn :
                            labels[item.key] || item.key;
                    return (
                        <div key={item.key} className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                            <span className="text-[10px] text-muted-foreground truncate">{label}</span>
                            <span className="text-[10px] font-bold text-foreground ml-auto tabular-nums">{val}</span>
                        </div>
                    );
                }).filter(Boolean)}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Mini Bar Chart (Payroll trend — compact)
// ════════════════════════════════════════════════════════════════════════════════

function PayrollBars({ data }: { data: { month: string; gross: number; net: number }[] }) {
    if (!data.length) return null;
    const maxVal = Math.max(...data.map(d => d.gross), 1);

    return (
        <div className="flex items-end gap-1.5 h-[60px]">
            {data.map((d, i) => {
                const grossH = Math.max(4, (d.gross / maxVal) * 56);
                const netH = Math.max(2, (d.net / maxVal) * 56);
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
                        <div className="w-full flex flex-col items-center gap-0">
                            <div
                                className="w-full rounded-t bg-blue-500/25 transition-all duration-300 group-hover:bg-blue-500/40"
                                style={{ height: grossH }}
                            />
                            <div
                                className="w-[60%] rounded-b bg-blue-500 transition-all duration-300 group-hover:bg-blue-400 -mt-px"
                                style={{ height: netH }}
                            />
                        </div>
                        <span className="text-[7px] text-tertiary-foreground leading-none">{d.month.split(' ')[0]}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Headcount Area Chart (compact)
// ════════════════════════════════════════════════════════════════════════════════

function HeadcountMiniChart({ data }: { data: { month: string; hires: number; separations: number }[] }) {
    if (data.length < 2) return null;
    const last6 = data.slice(-6);
    const max = Math.max(...last6.map(d => Math.max(d.hires, d.separations)), 1);
    const W = 200;
    const H = 56;

    const hiresPath = last6.map((d, i) => {
        const x = (i / (last6.length - 1)) * W;
        const y = H - (d.hires / max) * (H - 6) - 3;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    const sepsPath = last6.map((d, i) => {
        const x = (i / (last6.length - 1)) * W;
        const y = H - (d.separations / max) * (H - 6) - 3;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return (
        <div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[56px]">
                <defs>
                    <linearGradient id="hires-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={`${hiresPath} L${W},${H} L0,${H} Z`} fill="url(#hires-grad)" />
                <path d={hiresPath} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
                <path d={sepsPath} fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" opacity="0.7" />
            </svg>
            <div className="flex gap-4 mt-1.5">
                <div className="flex items-center gap-1">
                    <div className="h-1.5 w-3 rounded-full bg-emerald-500" />
                    <span className="text-[9px] text-muted-foreground">Hires</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-1.5 w-3 rounded-full bg-red-500/70 border border-red-500/50" style={{ borderStyle: "dashed" }} />
                    <span className="text-[9px] text-muted-foreground">Exits</span>
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Department Donut (compact)
// ════════════════════════════════════════════════════════════════════════════════

const COLORS = ["#3B82F6", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#6366F1"];

function DeptDonut({ departments }: { departments: { name: string; count: number }[] }) {
    const total = departments.reduce((s, d) => s + d.count, 0);
    if (total === 0) return null;

    const r = 32;
    const cx = 44;
    const cy = 44;
    const circ = 2 * Math.PI * r;
    let offset = 0;

    const top5 = departments.sort((a, b) => b.count - a.count).slice(0, 5);

    return (
        <div className="flex items-center gap-4">
            <svg viewBox="0 0 88 88" width={80} height={80} className="shrink-0">
                {top5.filter(d => d.count > 0).map((d, i) => {
                    const pct = d.count / total;
                    const dashLen = circ * pct;
                    const seg = (
                        <circle
                            key={i} cx={cx} cy={cy} r={r}
                            fill="none" stroke={COLORS[i % COLORS.length]}
                            strokeWidth="8" strokeDasharray={`${dashLen} ${circ - dashLen}`}
                            strokeDashoffset={-offset} strokeLinecap="round"
                            transform={`rotate(-90 ${cx} ${cy})`}
                        />
                    );
                    offset += dashLen;
                    return seg;
                })}
                <text x={cx} y={cy - 2} textAnchor="middle" className="fill-foreground text-[10px] font-bold">{total}</text>
                <text x={cx} y={cy + 8} textAnchor="middle" className="fill-muted-foreground text-[5px] uppercase">total</text>
            </svg>
            <div className="flex-1 space-y-1 min-w-0">
                {top5.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="text-[10px] text-muted-foreground truncate">{d.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-foreground tabular-nums shrink-0">{d.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// Main Dashboard — "Command Center"
// ════════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
    const { data: session } = useSession();
    const locale = useNextIntlLocale();
    const t = useTranslations('Dashboard');
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [greeting, setGreeting] = useState('');

    // Hydration-safe greeting — only compute on client
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting(t('goodMorning'));
        else if (hour < 17) setGreeting(t('goodAfternoon'));
        else setGreeting(t('goodEvening'));
    }, [t]);

    useEffect(() => { fetchAnalytics(); }, []);

    const fetchAnalytics = async () => {
        try {
            const res = await fetch("/api/dashboard/analytics");
            if (res.ok) setAnalytics(await res.json());
        } catch { /* silently handle — network/auth errors are expected during hydration */ }
        finally { setLoading(false); }
    };

    const userName = session?.user?.name || "Admin";
    const totalPending = analytics ? analytics.pendingActions.leaves + analytics.pendingActions.loans + analytics.pendingActions.expenses : 0;

    // Sparkline data from headcount trend
    const hireSparkData = useMemo(() =>
        analytics?.headcount.trend.slice(-7).map(t => t.hires) || [], [analytics]);

    const attendanceRate = analytics && analytics.headcount.total > 0
        ? Math.round(((analytics.attendance.present || 0) / analytics.headcount.total) * 100)
        : 0;

    const quickActions = [
        { label: t('markAttendance'), icon: Clock, color: "from-blue-500 to-blue-600", href: "/attendance" },
        { label: t('applyLeave'), icon: CalendarOff, color: "from-emerald-500 to-emerald-600", href: "/leaves/apply" },
        { label: t('runPayroll'), icon: Banknote, color: "from-purple-500 to-purple-600", href: "/payroll" },
        { label: t('addEmployeeAction'), icon: Users, color: "from-amber-500 to-amber-600", href: "/employees/new" },
        { label: t('viewReports'), icon: BarChart3, color: "from-cyan-500 to-cyan-600", href: "/reports" },
        { label: t('leavesAction'), icon: FileText, color: "from-pink-500 to-pink-600", href: "/leaves" },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-5">
                {/* ═══ HERO HEADER ═══ */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                            <Activity className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground tracking-tight">
                                {greeting || t('goodMorning')}, {userName}
                            </h1>
                            <p className="text-xs text-muted-foreground mt-0.5">{t('subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/leaves/calendar">
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('viewCalendar')}</span>
                            </Button>
                        </Link>
                        <Link href="/employees/new">
                            <Button size="sm" className="gap-1.5 text-xs h-8 bg-linear-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25">
                                <Users className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('addEmployee')}</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* ═══ BENTO GRID — Above the Fold ═══ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <PulseCard
                        title={t('totalEmployees')} loading={loading}
                        value={analytics ? formatNumber(analytics.headcount.total, locale) : "0"}
                        change={analytics ? t('newThisMonth', { count: formatNumber(analytics.headcount.newHires, locale) }) : ""}
                        changeType={analytics?.headcount.newHires ? "positive" : "neutral"}
                        Icon={Users} gradient="from-blue-500 to-blue-600" glow="bg-blue-500"
                        sparkData={hireSparkData} sparkColor="#3B82F6"
                    />
                    <PulseCard
                        title={t('presentToday')} loading={loading}
                        value={analytics ? formatNumber(analytics.attendance.present || 0, locale) : "0"}
                        change={`${attendanceRate}% ${t('attendance').toLowerCase()}`}
                        changeType={attendanceRate >= 80 ? "positive" : attendanceRate >= 50 ? "neutral" : "negative"}
                        Icon={UserCheck} gradient="from-emerald-500 to-emerald-600" glow="bg-emerald-500"
                    />
                    <PulseCard
                        title={t('onLeave')} loading={loading}
                        value={analytics ? formatNumber(analytics.leaves.onLeaveToday, locale) : "0"}
                        change={t('today')}
                        changeType="neutral"
                        Icon={CalendarOff} gradient="from-amber-500 to-amber-600" glow="bg-amber-500"
                    />
                    <PulseCard
                        title={t('pendingRequests')} loading={loading}
                        value={analytics ? formatNumber(totalPending, locale) : "0"}
                        change={t('awaitingApproval')}
                        changeType={totalPending > 0 ? "warning" : "neutral"}
                        Icon={Clock} gradient="from-purple-500 to-purple-600" glow="bg-purple-500"
                    />
                </div>

                {/* ═══ BENTO ROW 2 — Charts + Attention Panel ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                    {/* ── TODAY'S ATTENDANCE (Span 3) ── */}
                    <Card className="lg:col-span-4 relative overflow-hidden">
                        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-emerald-500 opacity-[0.06] blur-3xl" />
                        <CardContent className="p-4 relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-emerald-400" />
                                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('todaysAttendance')}</h3>
                                </div>
                                <Link href="/attendance">
                                    <Badge variant="default" className="text-[9px] cursor-pointer hover:bg-blue-500/20 transition-colors">
                                        <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                                        {t('viewAll')}
                                    </Badge>
                                </Link>
                            </div>
                            {loading ? (
                                <Skeleton className="h-[100px] w-full rounded-lg" />
                            ) : analytics ? (
                                <AttendanceRingCompact
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

                    {/* ── HEADCOUNT TREND (Span 4) ── */}
                    <Card className="lg:col-span-4 relative overflow-hidden">
                        <div className="absolute -top-16 -left-16 h-40 w-40 rounded-full bg-blue-500 opacity-[0.06] blur-3xl" />
                        <CardContent className="p-4 relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-blue-400" />
                                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('headcountTrend')}</h3>
                                </div>
                                <Badge variant="default" className="text-[9px]">{t('months6')}</Badge>
                            </div>
                            {loading ? (
                                <Skeleton className="h-[72px] w-full rounded-lg" />
                            ) : analytics?.headcount.trend ? (
                                <HeadcountMiniChart data={analytics.headcount.trend} />
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-6">{t('noDataAvailable')}</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── REQUIRES ATTENTION (Span 4) ── */}
                    <Card className="lg:col-span-4 relative overflow-hidden">
                        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-500 opacity-[0.06] blur-3xl" />
                        <CardContent className="p-4 relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-400" />
                                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('pendingActions')}</h3>
                                </div>
                                {totalPending > 0 && (
                                    <Badge className="bg-amber-500/20 text-amber-400 text-[9px]">
                                        {totalPending} items
                                    </Badge>
                                )}
                            </div>
                            {loading ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                                </div>
                            ) : analytics ? (
                                <div className="space-y-1.5">
                                    <Link href="/leaves/requests">
                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-hover hover:bg-card hover:-translate-y-0.5 transition-all cursor-pointer group">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                                                    <CalendarOff className="h-4 w-4 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-foreground">{t('leaveRequests')}</p>
                                                    <p className="text-[10px] text-muted-foreground">{t('awaitingApprovalLabel')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="warning" dot className="text-[10px]">{analytics.pendingActions.leaves}</Badge>
                                                <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    </Link>
                                    <Link href="/expenses">
                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-hover hover:bg-card hover:-translate-y-0.5 transition-all cursor-pointer group">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                                                    <Receipt className="h-4 w-4 text-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-foreground">{t('expenseClaims')}</p>
                                                    <p className="text-[10px] text-muted-foreground">{t('pendingReview')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="warning" dot className="text-[10px]">{analytics.pendingActions.expenses}</Badge>
                                                <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    </Link>
                                    <Link href="/loans">
                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-hover hover:bg-card hover:-translate-y-0.5 transition-all cursor-pointer group">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                                                    <Banknote className="h-4 w-4 text-purple-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-foreground">{t('loanRequests')}</p>
                                                    <p className="text-[10px] text-muted-foreground">{t('pendingApprovalAction')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="warning" dot className="text-[10px]">{analytics.pendingActions.loans}</Badge>
                                                <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>

                {/* ═══ BENTO ROW 3 — Payroll + Dept + Events + Quick Actions ═══ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">

                    {/* ── PAYROLL TREND (Span 3) ── */}
                    <Card className="lg:col-span-3 relative overflow-hidden">
                        <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-blue-500 opacity-[0.06] blur-3xl" />
                        <CardContent className="p-4 relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Banknote className="h-4 w-4 text-blue-400" />
                                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('payrollCostTrend')}</h3>
                                </div>
                                <Badge variant="default" className="text-[9px]">{t('months6')}</Badge>
                            </div>
                            {loading ? (
                                <Skeleton className="h-[72px] w-full rounded-lg" />
                            ) : analytics?.payrollCost && analytics.payrollCost.some(p => p.gross > 0) ? (
                                <div>
                                    <PayrollBars data={analytics.payrollCost} />
                                    <div className="flex gap-3 mt-2">
                                        <div className="flex items-center gap-1">
                                            <div className="h-1.5 w-3 rounded bg-blue-500/25" />
                                            <span className="text-[9px] text-muted-foreground">{t('gross')}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="h-1.5 w-3 rounded bg-blue-500" />
                                            <span className="text-[9px] text-muted-foreground">{t('net')}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-6">{t('noPayrollData')}</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── DEPARTMENT DISTRIBUTION (Span 3) ── */}
                    <Card className="lg:col-span-3 relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-purple-500 opacity-[0.06] blur-3xl" />
                        <CardContent className="p-4 relative">
                            <div className="flex items-center gap-2 mb-3">
                                <Briefcase className="h-4 w-4 text-purple-400" />
                                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('departmentDistribution')}</h3>
                            </div>
                            {loading ? (
                                <Skeleton className="h-[80px] w-full rounded-lg" />
                            ) : analytics?.departments && analytics.departments.length > 0 ? (
                                <DeptDonut departments={analytics.departments} />
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-6">{t('noDepartments')}</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── UPCOMING EVENTS (Span 3) ── */}
                    <Card className="lg:col-span-3 relative overflow-hidden">
                        <div className="absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-pink-500 opacity-[0.06] blur-3xl" />
                        <CardContent className="p-4 relative">
                            <div className="flex items-center gap-2 mb-3">
                                <Gift className="h-4 w-4 text-pink-400" />
                                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('upcomingEventsTitle')}</h3>
                            </div>
                            {loading ? (
                                <div className="space-y-2">
                                    {[1, 2].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
                                </div>
                            ) : (
                                <div className="space-y-1 max-h-[100px] overflow-y-auto scrollbar-thin">
                                    {analytics?.upcoming.birthdays.slice(0, 2).map((b, i) => (
                                        <div key={`b-${i}`} className="flex items-center gap-2.5 p-2 rounded-lg bg-hover hover:bg-card transition-colors">
                                            <div className="h-7 w-7 rounded-lg bg-pink-500/15 flex items-center justify-center shrink-0">
                                                <Gift className="h-3.5 w-3.5 text-pink-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-medium text-foreground truncate">{b.name}</p>
                                                <p className="text-[9px] text-muted-foreground">{t('birthday')} • {b.date}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {analytics?.upcoming.anniversaries.slice(0, 2).map((a, i) => (
                                        <div key={`a-${i}`} className="flex items-center gap-2.5 p-2 rounded-lg bg-hover hover:bg-card transition-colors">
                                            <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                                <Award className="h-3.5 w-3.5 text-amber-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-medium text-foreground truncate">{a.name}</p>
                                                <p className="text-[9px] text-muted-foreground">{t('yearAnniversary', { years: a.years })} • {a.date}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!analytics?.upcoming.birthdays.length && !analytics?.upcoming.anniversaries.length) && (
                                        <div className="text-center py-4">
                                            <Calendar className="h-6 w-6 text-tertiary-foreground mx-auto mb-1" />
                                            <p className="text-[10px] text-muted-foreground">{t('noUpcomingEvents30')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── QUICK ACTIONS (Span 3) ── */}
                    <Card className="lg:col-span-3 relative overflow-hidden">
                        <div className="absolute -top-10 -left-10 h-28 w-28 rounded-full bg-cyan-500 opacity-[0.06] blur-3xl" />
                        <CardContent className="p-4 relative">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield className="h-4 w-4 text-cyan-400" />
                                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{t('quickActions')}</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {quickActions.map((action) => (
                                    <Link key={action.label} href={action.href}>
                                        <div className="flex items-center gap-2 p-2 rounded-xl bg-hover hover:bg-card border border-transparent hover:border-card-border hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                                            <div className={`h-7 w-7 rounded-lg bg-linear-to-br ${action.color} flex items-center justify-center shrink-0 shadow-md`}>
                                                <action.icon className="h-3.5 w-3.5 text-white" />
                                            </div>
                                            <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight">{action.label}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
