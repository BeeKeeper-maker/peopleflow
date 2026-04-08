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
        if (!item.roles) return true;
        return item.roles.includes(userRole);
    }, [userRole]);

    const navigation = isPlatformPlane ? PLATFORM_NAVIGATION : TENANT_NAVIGATION.filter(canAccess);
    const actions = isPlatformPlane ? [] : TENANT_ACTIONS.filter(canAccess);

    if (!session) return null;

    return (
        <>
            {/* Trigger button */}
            <button
                onClick={() => setOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                aria-label="Open command palette"
            >
                <Search className="w-4 h-4" />
                <span>Search...</span>
                <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded">
                    ⌘K
                </kbd>
            </button>

            {/* Command Dialog */}
            {open && (
                <div className="fixed inset-0 z-100">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    />

                    <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-[640px] px-4">
                        <Command
                            className="rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
                            loop
                        >
                            <div className="flex items-center gap-2 px-4 border-b border-border">
                                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                                <Command.Input
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                    placeholder={isPlatformPlane ? "Search platform..." : "Search actions, pages, employees..."}
                                    className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
                                    autoFocus
                                />
                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-card border border-border rounded">
                                    ESC
                                </kbd>
                            </div>

                            <Command.List className="max-h-[360px] overflow-y-auto p-2">
                                <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                                    No results found.
                                </Command.Empty>

                                {actions.length > 0 && (
                                    <CmdGroup heading="Quick Actions" className="mb-1">
                                        {actions.map((item) => (
                                            <Command.Item
                                                key={item.href}
                                                value={`${item.label} ${item.keywords.join(" ")}`}
                                                onSelect={() => navigate(item.href)}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted transition-colors"
                                            >
                                                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/10">
                                                    <item.icon className="w-4 h-4 text-blue-500" />
                                                </div>
                                                <span className="flex-1">{item.label}</span>
                                                <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100" />
                                            </Command.Item>
                                        ))}
                                    </CmdGroup>
                                )}

                                <CmdGroup heading="Navigation" className="mb-1">
                                    {navigation.map((item) => (
                                        <Command.Item
                                            key={item.href}
                                            value={`${item.label} ${item.keywords.join(" ")}`}
                                            onSelect={() => navigate(item.href)}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted transition-colors"
                                        >
                                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-card">
                                                <item.icon className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <span className="flex-1">{item.label}</span>
                                            {pathname === item.href && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                                                    Current
                                                </span>
                                            )}
                                        </Command.Item>
                                    ))}
                                </CmdGroup>

                                {searchQuery.length >= 2 && Array.isArray((searchResults as any)?.data) && (
                                    <CmdGroup heading="Search Results">
                                        {(searchResults!.data as any[]).slice(0, 5).map((result: any, i: number) => (
                                            <Command.Item
                                                key={result.id || i}
                                                value={`search ${result.name || result.title || ""}`}
                                                onSelect={() => navigate(result.href || `/employees/${result.id}`)}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground cursor-pointer data-[selected=true]:bg-muted transition-colors"
                                            >
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-card">
                                                    <Users className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="truncate">{result.name || result.title}</p>
                                                    {result.department && (
                                                        <p className="text-xs text-muted-foreground truncate">{result.department}</p>
                                                    )}
                                                </div>
                                            </Command.Item>
                                        ))}
                                    </CmdGroup>
                                )}
                            </Command.List>

                            <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1 py-0.5 bg-card border border-border rounded">↑↓</kbd>
                                        Navigate
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1 py-0.5 bg-card border border-border rounded">↵</kbd>
                                        Select
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1 py-0.5 bg-card border border-border rounded">esc</kbd>
                                        Close
                                    </span>
                                </div>
                                <span className="flex items-center gap-1">
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
