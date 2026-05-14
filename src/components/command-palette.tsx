"use client";

/**
 * PeopleFlow Command Palette — Context-Aware Cmd+K
 *
 * - Strict dual-plane separation (Platform vs Tenant)
 * - RBAC-aware: ESS users see ESS routes, HR sees HR routes
 * - Groups: Navigation, Quick Actions, Live Search
 * - Keyboard: Cmd+K / Ctrl+K to open, arrows + Enter to navigate
 */

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Command } from "cmdk";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSearch } from "@/hooks/use-data";
import {
    LayoutDashboard, Users, Calendar, Clock, Banknote,
    UserPlus, Target, BarChart3, Building2, Settings,
    FileText, Receipt, Megaphone, HandCoins,
    Fingerprint, GitPullRequest, Search, Plus,
    ArrowRight, Command as CommandIcon,
} from "lucide-react";
import { canAccessPath, type EntitlementFeatures } from "@/lib/module-entitlements";

// ── Command Group wrapper (React 19 type compat) ─────────────────

function CmdGroup({ heading, children, className }: { heading: string; children: ReactNode; className?: string }) {
    return (
        <Command.Group heading={heading} className={className}>
            {children}
        </Command.Group>
    );
}

// ── Route Definitions ────────────────────────────────────────────

interface RouteItem {
    label: string;
    href: string;
    icon: React.ElementType;
    keywords: string[];
    roles?: string[];
}

const HR_ROLES = ["super_admin", "admin", "hr_admin"];
const MANAGER_ROLES = ["super_admin", "admin", "hr_admin", "manager"];

const TENANT_NAVIGATION: RouteItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "overview", "stats"], roles: HR_ROLES },
    { label: "Employees", href: "/employees", icon: Users, keywords: ["staff", "people", "team"], roles: HR_ROLES },
    { label: "Departments", href: "/departments", icon: Building2, keywords: ["teams", "division"], roles: HR_ROLES },
    { label: "Leave Management", href: "/leaves", icon: Calendar, keywords: ["vacation", "time off", "absence"], roles: HR_ROLES },
    { label: "Attendance", href: "/attendance", icon: Clock, keywords: ["check in", "clock", "track"], roles: HR_ROLES },
    { label: "Payroll", href: "/payroll", icon: Banknote, keywords: ["salary", "pay", "compensation"], roles: HR_ROLES },
    { label: "Recruitment", href: "/recruitment", icon: UserPlus, keywords: ["hiring", "jobs", "candidates"], roles: HR_ROLES },
    { label: "Performance", href: "/performance", icon: Target, keywords: ["goals", "reviews", "kpi"], roles: HR_ROLES },
    { label: "Expenses", href: "/expenses", icon: Receipt, keywords: ["claims", "reimbursement"], roles: HR_ROLES },
    { label: "Loans", href: "/loans", icon: HandCoins, keywords: ["advance", "borrowing"], roles: HR_ROLES },
    { label: "Reports", href: "/reports", icon: BarChart3, keywords: ["analytics", "data"], roles: HR_ROLES },
    { label: "Announcements", href: "/announcements", icon: Megaphone, keywords: ["news", "notice"], roles: HR_ROLES },
    { label: "Approval Workflows", href: "/approval-workflows", icon: GitPullRequest, keywords: ["approve", "request"], roles: HR_ROLES },
    { label: "Documents", href: "/documents", icon: FileText, keywords: ["files", "docs"], roles: HR_ROLES },
    { label: "Devices", href: "/devices", icon: Fingerprint, keywords: ["biometric", "scanner"], roles: HR_ROLES },
    { label: "Settings", href: "/settings", icon: Settings, keywords: ["config", "preferences"], roles: HR_ROLES },
    { label: "Manager Dashboard", href: "/manager/dashboard", icon: LayoutDashboard, keywords: ["manager", "team overview"], roles: MANAGER_ROLES },
    { label: "My Dashboard", href: "/ess/dashboard", icon: LayoutDashboard, keywords: ["my overview", "self service"] },
    { label: "My Leaves", href: "/ess/leaves", icon: Calendar, keywords: ["my vacation", "my time off"] },
    { label: "My Attendance", href: "/ess/attendance", icon: Clock, keywords: ["my attendance", "my clock"] },
    { label: "My Payslips", href: "/ess/payslips", icon: Banknote, keywords: ["my salary", "my pay slip"] },
    { label: "My Expenses", href: "/ess/expenses", icon: Receipt, keywords: ["my claims", "my expense"] },
    { label: "My Profile", href: "/profile", icon: Users, keywords: ["my profile", "account"] },
];

const TENANT_ACTIONS: RouteItem[] = [
    { label: "Add Employee", href: "/employees/new", icon: Plus, keywords: ["create", "new employee", "hire"], roles: HR_ROLES },
    { label: "Apply Leave", href: "/ess/leaves/apply", icon: Plus, keywords: ["request leave", "time off request"] },
    { label: "Post Job", href: "/recruitment/jobs/new", icon: Plus, keywords: ["create job", "new position"], roles: HR_ROLES },
    { label: "Set Goal", href: "/performance/goals/new", icon: Plus, keywords: ["create goal", "new objective"], roles: MANAGER_ROLES },
];

const PLATFORM_NAVIGATION: RouteItem[] = [
    { label: "Platform Dashboard", href: "/platform/dashboard", icon: LayoutDashboard, keywords: ["overview", "metrics"] },
    { label: "Tenant Management", href: "/platform/tenants", icon: Building2, keywords: ["organizations", "clients"] },
    { label: "Billing & Plans", href: "/platform/plans", icon: Banknote, keywords: ["pricing", "subscription"] },
    { label: "Platform Audit Logs", href: "/platform/audit-logs", icon: FileText, keywords: ["logs", "activity"] },
];

// ── Component ────────────────────────────────────────────────────

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const router = useRouter();
    const pathname = usePathname();
    const { data: session } = useSession();
    const { data: searchResults } = useSearch(searchQuery);

    const userRole = (session?.user as any)?.role || "employee";
    const features = (session?.user as any)?.features as EntitlementFeatures | undefined;
    const isPlatformPlane = pathname.startsWith("/platform");

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const navigate = useCallback((href: string) => {
        setOpen(false);
        setSearchQuery("");
        router.push(href);
    }, [router]);

    const canAccess = useCallback((item: RouteItem) => {
        const roleAllowed = !item.roles || item.roles.includes(userRole);
        const entitlementAllowed = isPlatformPlane || canAccessPath(features, item.href, "page").allowed;
        return roleAllowed && entitlementAllowed;
    }, [features, isPlatformPlane, userRole]);

    const navigation = isPlatformPlane ? PLATFORM_NAVIGATION : TENANT_NAVIGATION.filter(canAccess);
    const actions = isPlatformPlane ? [] : TENANT_ACTIONS.filter(canAccess);

    if (!session) return null;

    return (
        <>
            {/* Sidebar Trigger — compact pill */}
            <button
                onClick={() => setOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-item-hover transition-all duration-200"
                aria-label="Open command palette (⌘K)"
                title="Search (⌘K)"
            >
                <Search className="w-4 h-4" />
            </button>

            {/* Command Dialog */}
            {open && (
                <div className="fixed inset-0 z-[100]">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        onClick={() => setOpen(false)}
                    />

                    {/* Dialog Container */}
                    <div className="absolute left-1/2 top-[18%] -translate-x-1/2 w-full max-w-2xl px-4">
                        <Command
                            className="rounded-2xl border border-white/[0.08] bg-[#161621] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(99,102,241,0.05)] overflow-hidden"
                            loop
                        >
                            {/* ── Search Input ── */}
                            <div className="flex items-center gap-3 px-5 border-b border-white/[0.06]">
                                <Search className="w-[18px] h-[18px] text-zinc-500 shrink-0" />
                                <Command.Input
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                    placeholder={isPlatformPlane ? "Search platform..." : "Search actions, pages, employees..."}
                                    className="flex-1 h-14 bg-transparent text-[15px] text-white placeholder-zinc-500 outline-none border-none focus:ring-0 focus:outline-none caret-indigo-400"
                                    autoFocus
                                />
                                <kbd className="flex items-center px-2 py-1 text-[10px] font-mono text-zinc-500 bg-white/[0.04] border border-white/[0.08] rounded-md shrink-0">
                                    ESC
                                </kbd>
                            </div>

                            {/* ── Results List ── */}
                            <Command.List className="max-h-[400px] overflow-y-auto p-2 scrollbar-thin">
                                <Command.Empty className="py-12 text-center text-sm text-zinc-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search className="w-8 h-8 text-zinc-700" />
                                        <span>No results found</span>
                                    </div>
                                </Command.Empty>

                                {/* Quick Actions */}
                                {actions.length > 0 && (
                                    <CmdGroup
                                        heading="Quick Actions"
                                        className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-zinc-500 mb-1"
                                    >
                                        {actions.map((item) => (
                                            <Command.Item
                                                key={item.href}
                                                value={`${item.label} ${item.keywords.join(" ")}`}
                                                onSelect={() => navigate(item.href)}
                                                className="group flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl text-sm text-zinc-300 cursor-pointer transition-all duration-150 data-[selected=true]:bg-indigo-500/[0.12] data-[selected=true]:text-white hover:bg-white/[0.03]"
                                            >
                                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/15 transition-colors group-data-[selected=true]:bg-indigo-500/20 group-data-[selected=true]:border-indigo-500/25">
                                                    <item.icon className="w-4 h-4 text-indigo-400" />
                                                </div>
                                                <span className="flex-1 font-medium">{item.label}</span>
                                                <ArrowRight className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity" />
                                            </Command.Item>
                                        ))}
                                    </CmdGroup>
                                )}

                                {/* Navigation */}
                                <CmdGroup
                                    heading="Navigation"
                                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-zinc-500 mb-1"
                                >
                                    {navigation.map((item) => (
                                        <Command.Item
                                            key={item.href}
                                            value={`${item.label} ${item.keywords.join(" ")}`}
                                            onSelect={() => navigate(item.href)}
                                            className="group flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl text-sm text-zinc-300 cursor-pointer transition-all duration-150 data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white hover:bg-white/[0.03]"
                                        >
                                            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] transition-colors group-data-[selected=true]:bg-white/[0.08] group-data-[selected=true]:border-white/[0.1]">
                                                <item.icon className="w-4 h-4 text-zinc-400 group-data-[selected=true]:text-zinc-200" />
                                            </div>
                                            <span className="flex-1">{item.label}</span>
                                            {pathname === item.href && (
                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                                                    Current
                                                </span>
                                            )}
                                            <ArrowRight className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity" />
                                        </Command.Item>
                                    ))}
                                </CmdGroup>

                                {/* Search Results */}
                                {searchQuery.length >= 2 && Array.isArray((searchResults as any)?.data) && (
                                    <CmdGroup
                                        heading="Search Results"
                                        className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-zinc-500"
                                    >
                                        {(searchResults!.data as any[]).slice(0, 5).map((result: any, i: number) => (
                                            <Command.Item
                                                key={result.id || i}
                                                value={`search ${result.name || result.title || ""}`}
                                                onSelect={() => navigate(result.href || `/employees/${result.id}`)}
                                                className="group flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl text-sm text-zinc-300 cursor-pointer transition-all duration-150 data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white hover:bg-white/[0.03]"
                                            >
                                                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06]">
                                                    <Users className="w-4 h-4 text-zinc-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="truncate font-medium">{result.name || result.title}</p>
                                                    {result.department && (
                                                        <p className="text-xs text-zinc-500 truncate">{result.department}</p>
                                                    )}
                                                </div>
                                                <ArrowRight className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity" />
                                            </Command.Item>
                                        ))}
                                    </CmdGroup>
                                )}
                            </Command.List>

                            {/* ── Footer ── */}
                            <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.06] bg-white/[0.01]">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                        <kbd className="px-1.5 py-0.5 font-mono bg-white/[0.04] border border-white/[0.08] rounded">↑↓</kbd>
                                        Navigate
                                    </span>
                                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                        <kbd className="px-1.5 py-0.5 font-mono bg-white/[0.04] border border-white/[0.08] rounded">↵</kbd>
                                        Select
                                    </span>
                                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                        <kbd className="px-1.5 py-0.5 font-mono bg-white/[0.04] border border-white/[0.08] rounded">esc</kbd>
                                        Close
                                    </span>
                                </div>
                                <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                                    <CommandIcon className="w-3 h-3" />
                                    PeopleFlow
                                </span>
                            </div>
                        </Command>
                    </div>
                </div>
            )}
        </>
    );
}

