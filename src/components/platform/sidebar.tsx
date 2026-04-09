"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const NAV_ITEMS = [
    { href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/platform/leads", label: "Leads", icon: Target },
    { href: "/platform/tenants", label: "Tenants", icon: Building2 },
    { href: "/platform/plans", label: "Plans", icon: CreditCard },
    { href: "/platform/audit-logs", label: "Audit Logs", icon: ScrollText },
];

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

            {/* System Status */}
            {!collapsed && (
                <div className="px-4 py-3 mx-3 mb-3 rounded-lg bg-emerald-500/8 border border-emerald-500/12">
                    <div className="flex items-center gap-2">
                        <div className="relative w-2 h-2 bg-emerald-400 rounded-full">
                            <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                        </div>
                        <span className="text-xs text-emerald-400 font-medium">
                            All Systems Operational
                        </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                        <Zap className="w-3 h-3 text-zinc-600" />
                        <span className="text-[10px] text-zinc-600">
                            DB • Redis • Stripe
                        </span>
                    </div>
                </div>
            )}

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
