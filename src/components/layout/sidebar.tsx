"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    User,
    Calendar,
    Clock,
    Banknote,
    UserPlus,
    Target,
    BarChart3,
    Building2,
    Settings,
    LogOut,
    ChevronRight,
    ChevronDown,
    Briefcase,
    FileBarChart,
    Layers,
    FileText,
    Receipt,
    ShieldCheck,
    ScrollText,
    CalendarDays,
    Building,
    Megaphone,
    HandCoins,
    GitPullRequest,
    Fingerprint,
    KeyRound,
    ClipboardCheck,
    Bell,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { CommandPalette } from "@/components/command-palette";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { PREFETCH_CONFIGS } from "@/hooks/use-prefetch";
import { useTranslations } from 'next-intl';
import { canAccessPath, type EntitlementFeatures } from "@/lib/module-entitlements";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface NavItem {
    labelKey: string;
    href: string;
    icon: React.ElementType;
    badge?: number;
    roles?: string[];
}

interface NavSection {
    key: string;
    labelKey: string;
    items: NavItem[];
}

// ─── Navigation Structure ───────────────────────────────────────────────────────

const navSections: NavSection[] = [
    {
        key: "HR_MANAGEMENT",
        labelKey: "hrManagement",
        items: [
            { labelKey: "employees", href: "/employees", icon: Users, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "leaveRequests", href: "/leaves/requests", icon: FileBarChart, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "leaveSettings", href: "/leaves/types", icon: Settings, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "calendar", href: "/leaves/calendar", icon: Calendar, roles: ["super_admin", "admin", "hr_admin", "manager"] },
            { labelKey: "documents", href: "/documents", icon: FileText, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "expenses", href: "/expenses", icon: Receipt, roles: ["super_admin", "admin", "hr_admin", "manager"] },
        ],
    },
    {
        key: "OPERATIONS",
        labelKey: "operations",
        items: [
            { labelKey: "attendance", href: "/attendance", icon: Clock, roles: ["super_admin", "admin", "hr_admin", "manager"] },
            { labelKey: "performance", href: "/performance", icon: Target, roles: ["super_admin", "admin", "hr_admin", "manager"] },
            { labelKey: "payroll", href: "/payroll", icon: Banknote, roles: ["super_admin", "admin", "hr_admin"] },

            { labelKey: "recruitment", href: "/recruitment", icon: UserPlus, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "compliance", href: "/compliance", icon: ShieldCheck, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "reports", href: "/reports", icon: BarChart3, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "announcements", href: "/announcements", icon: Megaphone, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "loans", href: "/loans", icon: HandCoins, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "auditLogs", href: "/audit-logs", icon: ScrollText, roles: ["super_admin", "admin"] },
        ],
    },
    {
        key: "SETUP",
        labelKey: "setup",
        items: [
            { labelKey: "departments", href: "/departments", icon: Building2, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "designations", href: "/designations", icon: Briefcase, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "shifts", href: "/organization/shifts", icon: Clock, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "holidays", href: "/organization/holidays", icon: CalendarDays, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "branches", href: "/organization/branches", icon: Building, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "setupReadiness", href: "/settings/readiness", icon: ClipboardCheck, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "approvalWorkflows", href: "/approval-workflows", icon: GitPullRequest, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "accessControl", href: "/settings/access", icon: KeyRound, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "rolesPermissions", href: "/settings/roles", icon: ShieldCheck, roles: ["super_admin", "admin", "hr_admin"] },
            { labelKey: "notificationPrefs", href: "/settings/notifications", icon: Bell, roles: ["super_admin", "admin", "hr_admin", "manager", "employee"] },
            { labelKey: "devices", href: "/devices", icon: Fingerprint, roles: ["super_admin", "admin", "hr_admin"] },

            { labelKey: "settings", href: "/settings", icon: Settings, roles: ["super_admin", "admin"] },
        ],
    },
];

// ─── Role Badge Colors ──────────────────────────────────────────────────────────

const roleBadgeStyles: Record<string, string> = {
    super_admin: "from-red-500 to-orange-500 text-foreground",
    admin: "from-purple-500 to-indigo-500 text-foreground",
    hr_admin: "from-blue-500 to-cyan-500 text-foreground",
    manager: "from-emerald-500 to-teal-500 text-foreground",
    employee: "from-slate-500 to-slate-600 text-foreground",
};

const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    hr_admin: "HR Admin",
    manager: "Manager",
    employee: "Employee",
};

// ─── Sidebar Component ──────────────────────────────────────────────────────────

export function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const userRole = session?.user?.role || "employee";
    const features = session?.user?.features as EntitlementFeatures | undefined;
    const t = useTranslations('Nav');

    // Filter sections by role
    const filteredSections = useMemo(() =>
        navSections
            .map((section) => ({
                ...section,
                items: section.items.filter((item) => {
                    const roleAllowed = !item.roles || item.roles.includes(userRole);
                    const entitlementAllowed = canAccessPath(features, item.href, "page").allowed;
                    return roleAllowed && entitlementAllowed;
                }),
            }))
            .filter((section) => section.items.length > 0),
        [features, userRole]
    );

    // Determine which sections should be expanded based on active path
    const getExpandedFromPath = useCallback((currentPath: string) => {
        const expanded: Record<string, boolean> = {};
        filteredSections.forEach((section) => {
            const hasActiveItem = section.items.some(
                (item) => currentPath === item.href || currentPath.startsWith(item.href + "/")
            );
            expanded[section.key] = hasActiveItem;
        });
        // If no section is active, expand the first one
        if (!Object.values(expanded).some(Boolean) && filteredSections.length > 0) {
            expanded[filteredSections[0].key] = true;
        }
        return expanded;
    }, [filteredSections]);

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
        getExpandedFromPath(pathname)
    );

    // Auto-expand section when navigating to a new route
    useEffect(() => {
        setExpandedSections((prev) => {
            const updated = { ...prev };
            filteredSections.forEach((section) => {
                const hasActiveItem = section.items.some(
                    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
                );
                // Only expand, never auto-collapse on navigation
                if (hasActiveItem) {
                    updated[section.key] = true;
                }
            });
            return updated;
        });
    }, [pathname, filteredSections]);

    const toggleSection = useCallback((label: string) => {
        setExpandedSections((prev) => ({
            ...prev,
            [label]: !prev[label],
        }));
    }, []);

    const isDashboardActive = pathname === "/dashboard" || pathname === "/";
    const isProfileActive = pathname === "/profile";

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar-bg backdrop-blur-2xl transition-colors duration-300">
            {/* Logo Header */}
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
                <Link href="/dashboard" className="flex items-center gap-2.5 group">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow duration-300">
                            <Layers className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-foreground tracking-tight">PeopleFlow</h1>
                        <p className="text-[9px] font-medium text-tertiary-foreground tracking-widest uppercase">HRMS Platform</p>
                    </div>
                </Link>
                <CommandPalette />
                <NotificationCenter />
            </div>

            {/* Gradient Accent Line */}
            <div className="h-px bg-linear-to-r from-transparent via-sidebar-accent-line to-transparent" />

            {/* Scrollable Navigation */}
            <nav className="flex flex-col h-[calc(100vh-57px)]">
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin">
                    {/* Dashboard - standalone top item */}
                    <Link
                        href="/dashboard"
                        className={cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium",
                            "transition-all duration-200 ease-out",
                            isDashboardActive
                                ? "bg-linear-to-r from-blue-500/15 to-indigo-500/10 text-foreground sidebar-accent-bar"
                                : "text-sidebar-item-text hover:text-sidebar-item-text-hover hover:bg-sidebar-item-hover"
                        )}
                    >
                        <div className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200",
                            isDashboardActive
                                ? "bg-sidebar-icon-active-bg text-blue-400"
                                : "text-sidebar-item-icon group-hover:text-sidebar-item-icon-hover"
                        )}>
                            <LayoutDashboard className="h-4 w-4" />
                        </div>
                        <span className="flex-1">{t('dashboard')}</span>
                        {isDashboardActive && (
                            <ChevronRight className="h-3.5 w-3.5 text-blue-400/60" />
                        )}
                    </Link>

                    {/* Collapsible Sections */}
                    {filteredSections.map((section) => {
                        const isExpanded = expandedSections[section.key] ?? false;
                        const hasActiveItem = section.items.some(
                            (item) => pathname === item.href || pathname.startsWith(item.href + "/")
                        );

                        return (
                            <div key={section.key} className="pt-2">
                                {/* Section Header - Clickable toggle */}
                                <button
                                    onClick={() => toggleSection(section.key)}
                                    className="flex items-center gap-2 w-full px-3 mb-1 group/header"
                                >
                                    <span className={cn(
                                        "text-[10px] font-semibold tracking-[0.12em] uppercase transition-colors duration-200",
                                        hasActiveItem ? "text-blue-400/60" : "text-sidebar-section-text group-hover/header:text-sidebar-item-text"
                                    )}>
                                        {t(section.labelKey)}
                                    </span>
                                    <div className="flex-1 h-px bg-sidebar-section-divider" />
                                    <ChevronDown className={cn(
                                        "h-3 w-3 text-sidebar-section-text transition-transform duration-200 group-hover/header:text-sidebar-item-text",
                                        isExpanded ? "rotate-0" : "-rotate-90"
                                    )} />
                                </button>

                                {/* Section Items - Collapsible */}
                                <div className={cn(
                                    "overflow-hidden transition-all duration-300 ease-out",
                                    isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                                )}>
                                    <div className="space-y-0.5">
                                        {section.items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                                            return (
                                                <PrefetchLink
                                                    key={item.href}
                                                    href={item.href}
                                                    className={cn(
                                                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium",
                                                        "transition-all duration-200 ease-out",
                                                        isActive
                                                            ? "bg-linear-to-r from-blue-500/15 to-indigo-500/10 text-foreground sidebar-accent-bar"
                                                            : "text-sidebar-item-text hover:text-sidebar-item-text-hover hover:bg-sidebar-item-hover"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200",
                                                        isActive
                                                            ? "bg-sidebar-icon-active-bg text-blue-400"
                                                            : "text-sidebar-item-icon group-hover:text-sidebar-item-icon-hover"
                                                    )}>
                                                        <Icon className="h-4 w-4" />
                                                    </div>

                                                    <span className="flex-1">{t(item.labelKey)}</span>

                                                    {item.badge && (
                                                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500/20 px-1.5 text-[10px] font-semibold text-blue-400 ring-1 ring-blue-500/30">
                                                            {item.badge}
                                                        </span>
                                                    )}

                                                    {isActive && (
                                                        <ChevronRight className="h-3.5 w-3.5 text-blue-400/60" />
                                                    )}
                                                </PrefetchLink>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Section - Compact */}
                <div className="border-t border-sidebar-border p-2 space-y-1">
                    {/* Profile Link */}
                    <Link
                        href="/profile"
                        className={cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium",
                            "transition-all duration-200",
                            isProfileActive
                                ? "bg-linear-to-r from-blue-500/15 to-indigo-500/10 text-foreground"
                                : "text-sidebar-item-text hover:text-sidebar-item-text-hover hover:bg-sidebar-item-hover"
                        )}
                    >
                        {isProfileActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-linear-to-b from-blue-400 to-indigo-500" />
                        )}
                        <div className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200",
                            isProfileActive
                                ? "bg-sidebar-icon-active-bg text-blue-400"
                                : "text-sidebar-item-icon group-hover:text-sidebar-item-icon-hover"
                        )}>
                            <User className="h-4 w-4" />
                        </div>
                        <span>{t('profile')}</span>
                    </Link>

                    {/* Theme & Language */}
                    <ThemeToggle variant="compact" />
                    <LanguageSwitcher variant="compact" />

                    {/* User Profile Card */}
                    <UserProfileCard userName={session?.user?.name || "User"} userRole={userRole} />
                </div>
            </nav>
        </aside>
    );
}

// ─── Prefetch Link ──────────────────────────────────────────────────────────────

/**
 * A Link component that prefetches API data on mouse hover.
 * Uses the PREFETCH_CONFIGS map keyed by href.
 */
function PrefetchLink({ href, children, ...props }: React.ComponentProps<typeof Link>) {
    const queryClient = useQueryClient();

    const handleMouseEnter = useCallback(() => {
        const config = PREFETCH_CONFIGS[href as string];
        if (config) {
            queryClient.prefetchQuery({
                queryKey: config.queryKey,
                queryFn: () => api.get(config.endpoint),
                staleTime: 30_000,
            });
        }
    }, [href, queryClient]);

    return (
        <Link href={href} onMouseEnter={handleMouseEnter} {...props}>
            {children}
        </Link>
    );
}

// ─── User Profile Card ──────────────────────────────────────────────────────────

function UserProfileCard({ userName, userRole }: { userName: string; userRole: string }) {
    const handleLogout = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const badgeStyle = roleBadgeStyles[userRole] || roleBadgeStyles.employee;
    const roleLabel = roleLabels[userRole] || "Employee";

    return (
        <div className="rounded-lg border border-card-border bg-card-bg p-2.5 transition-colors hover:bg-hover">
            <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 ring-2 ring-border">
                    <AvatarFallback className={cn("bg-linear-to-br text-foreground text-[10px] font-semibold", badgeStyle)}>
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{userName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={cn("w-1.5 h-1.5 rounded-full bg-linear-to-r", badgeStyle)} />
                        <span className="text-[10px] font-medium text-tertiary-foreground">{roleLabel}</span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="rounded-md p-1.5 text-tertiary-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                    title="Logout"
                >
                    <LogOut className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
