"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    LayoutDashboard,
    Building2,
    CreditCard,
    ScrollText,
    Shield,
    ChevronLeft,
    ChevronRight,
    Zap,
    Target,
    Users,
    LifeBuoy,
    AlertTriangle,
    CheckCircle2,
    Loader2,
} from "lucide-react";

const NAV_ITEMS = [
    { href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/platform/employees", label: "Employees", icon: Users },
    { href: "/platform/leads", label: "Leads", icon: Target },
    { href: "/platform/tenants", label: "Tenants", icon: Building2 },
    { href: "/platform/billing", label: "Billing", icon: CreditCard },
    { href: "/platform/support", label: "Support", icon: LifeBuoy },
    { href: "/platform/plans", label: "Plans", icon: Zap },
    { href: "/platform/audit-logs", label: "Audit Logs", icon: ScrollText },
];

interface SystemHealth {
    status: "healthy" | "degraded" | "down" | "checking";
    database: "healthy" | "unreachable" | "unknown";
    redis: "healthy" | "unreachable" | "skipped" | "unknown";
    memory: "healthy" | "warning" | "unknown";
    latency: { database: number; redis: number };
}

function useSystemHealth() {
    const [health, setHealth] = useState<SystemHealth>({
        status: "checking",
        database: "unknown",
        redis: "unknown",
        memory: "unknown",
        latency: { database: -1, redis: -1 },
    });

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await fetch("/api/health?deep=1", { cache: "no-store" });
                const data = await res.json();
                const checks = data.checks || {};

                const dbStatus = checks.database?.status || "unknown";
                const redisStatus = checks.redis?.status || "unknown";
                const memStatus = checks.memory?.status || "unknown";

                // Determine overall status
                let overall: SystemHealth["status"] = "healthy";
                if (dbStatus === "unreachable" || redisStatus === "unreachable") {
                    overall = "degraded";
                }
                if (dbStatus === "unreachable" && redisStatus === "unreachable") {
                    overall = "down";
                }

                setHealth({
                    status: overall,
                    database: dbStatus,
                    redis: redisStatus,
                    memory: memStatus,
                    latency: {
                        database: checks.database?.latency ?? -1,
                        redis: checks.redis?.latency ?? -1,
                    },
                });
            } catch {
                setHealth((prev) => ({ ...prev, status: "down" }));
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 60000); // Check every 60s
        return () => clearInterval(interval);
    }, []);

    return health;
}

function SystemHealthIndicator({ collapsed }: { collapsed: boolean }) {
    const health = useSystemHealth();

    const config = {
        healthy: {
            color: "text-emerald-400",
            bg: "bg-emerald-500/8",
            border: "border-emerald-500/12",
            dot: "bg-emerald-400",
            label: "All Systems Operational",
            icon: CheckCircle2,
        },
        degraded: {
            color: "text-amber-400",
            bg: "bg-amber-500/8",
            border: "border-amber-500/12",
            dot: "bg-amber-400",
            label: "Degraded Performance",
            icon: AlertTriangle,
        },
        down: {
            color: "text-red-400",
            bg: "bg-red-500/8",
            border: "border-red-500/12",
            dot: "bg-red-400",
            label: "System Issues",
            icon: AlertTriangle,
        },
        checking: {
            color: "text-zinc-400",
            bg: "bg-zinc-500/8",
            border: "border-zinc-500/12",
            dot: "bg-zinc-400",
            label: "Checking...",
            icon: Loader2,
        },
    };

    const c = config[health.status];
    const Icon = c.icon;

    if (collapsed) {
        return (
            <div className="px-4 py-3 mx-3 mb-3 flex justify-center">
                <div className={`relative w-2 h-2 ${c.dot} rounded-full`}>
                    {health.status === "healthy" && (
                        <div className={`absolute inset-0 ${c.dot} rounded-full animate-ping opacity-75`} />
                    )}
                    {health.status === "checking" && (
                        <Icon className="w-3 h-3 animate-spin" />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`px-4 py-3 mx-3 mb-3 rounded-lg ${c.bg} border ${c.border}`}>
            <div className="flex items-center gap-2">
                <div className={`relative w-2 h-2 ${c.dot} rounded-full`}>
                    {health.status === "healthy" && (
                        <div className={`absolute inset-0 ${c.dot} rounded-full animate-ping opacity-75`} />
                    )}
                    {health.status === "checking" && <Icon className="w-3 h-3 animate-spin" />}
                </div>
                <span className={`text-xs ${c.color} font-medium`}>
                    {c.label}
                </span>
            </div>
            {health.status !== "checking" && (
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-600">
                    <span className={health.database === "healthy" ? "text-emerald-400" : health.database === "unreachable" ? "text-red-400" : "text-zinc-600"}>
                        DB{health.latency.database >= 0 ? ` ${health.latency.database}ms` : ""}
                    </span>
                    <span className={health.redis === "healthy" ? "text-emerald-400" : health.redis === "unreachable" ? "text-red-400" : "text-zinc-600"}>
                        Redis{health.latency.redis >= 0 ? ` ${health.latency.redis}ms` : ""}
                    </span>
                </div>
            )}
        </div>
    );
}

interface PlatformSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function PlatformSidebar({ collapsed, onToggle }: PlatformSidebarProps) {
    const pathname = usePathname();

    return (
        <aside
            className={`fixed top-0 left-0 h-screen bg-[#0A0A12]/98 border-r border-white/6 flex flex-col z-50 transition-all duration-300 ${
                collapsed ? "w-[72px]" : "w-[260px]"
            }`}
        >
            {/* Logo */}
            <div className="h-16 flex items-center px-5 border-b border-white/6">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-white" />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white tracking-tight">
                                Mission Control
                            </span>
                            <span className="text-[10px] text-indigo-400 font-medium tracking-widest uppercase">
                                Platform Admin
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin">
                {!collapsed && (
                    <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider px-3 mb-3">
                        Navigation
                    </p>
                )}
                {NAV_ITEMS.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/platform/dashboard" &&
                            pathname.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                                isActive
                                    ? "text-white bg-linear-to-r from-indigo-500/15 to-violet-500/10"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/4"
                            }`}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full bg-linear-to-b from-indigo-400 to-violet-500" />
                            )}
                            <div
                                className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors ${
                                    isActive
                                        ? "bg-indigo-500/20 text-indigo-400"
                                        : "text-zinc-500 group-hover:text-zinc-400"
                                }`}
                            >
                                <Icon className="w-[18px] h-[18px]" />
                            </div>
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* System Health — REAL checks */}
            <SystemHealthIndicator collapsed={collapsed} />

            {/* Collapse Toggle */}
            <button
                onClick={onToggle}
                className="h-12 flex items-center justify-center border-t border-white/6 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
                {collapsed ? (
                    <ChevronRight className="w-4 h-4" />
                ) : (
                    <ChevronLeft className="w-4 h-4" />
                )}
            </button>
        </aside>
    );
}
