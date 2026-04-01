"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    User,
    Calendar,
    Clock,
    Receipt,
    Bell,
    LogOut,
    Menu,
    X,
    ChevronRight,
    Layers,
    Wallet,
    Banknote,
    Megaphone,
    FileText,
    Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLocale as useNextIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";

interface ESSLayoutProps {
    children: ReactNode;
}

interface NavItem {
    label: string;
    labelBn: string;
    href: string;
    icon: React.ElementType;
}

interface NavSection {
    label: string;
    labelBn: string;
    items: NavItem[];
}

const navSections: NavSection[] = [
    {
        label: "MY WORKSPACE",
        labelBn: "আমার ওয়ার্কস্পেস",
        items: [
            { label: "Dashboard", labelBn: "ড্যাশবোর্ড", href: "/ess/dashboard", icon: LayoutDashboard },
            { label: "My Profile", labelBn: "আমার প্রোফাইল", href: "/ess/profile", icon: User },
        ],
    },
    {
        label: "TIME & LEAVE",
        labelBn: "সময় ও ছুটি",
        items: [
            { label: "My Leaves", labelBn: "আমার ছুটি", href: "/ess/leaves", icon: Calendar },
            { label: "My Attendance", labelBn: "আমার উপস্থিতি", href: "/ess/attendance", icon: Clock },
        ],
    },
    {
        label: "COMPENSATION",
        labelBn: "ক্ষতিপূরণ",
        items: [
            { label: "My Payslips", labelBn: "আমার বেতন স্লিপ", href: "/ess/payslips", icon: Wallet },
            { label: "My Expenses", labelBn: "আমার খরচ", href: "/ess/expenses", icon: Receipt },
            { label: "My Loans", labelBn: "আমার ঋণ", href: "/ess/loans", icon: Banknote },
        ],
    },
    {
        label: "INFORMATION",
        labelBn: "তথ্য",
        items: [
            { label: "Announcements", labelBn: "ঘোষণাসমূহ", href: "/ess/announcements", icon: Megaphone },
            { label: "My Documents", labelBn: "আমার ডকুমেন্ট", href: "/ess/documents", icon: FileText },
            { label: "My Performance", labelBn: "আমার কর্মদক্ষতা", href: "/ess/performance", icon: Target },
        ],
    },
];

export default function ESSLayout({ children }: ESSLayoutProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const locale = useNextIntlLocale();
    const t = useTranslations('ESS');

    const user = session?.user;
    const initials = user?.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U";

    return (
        <div className="min-h-screen bg-background transition-colors duration-300">
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-header-bg backdrop-blur-xl border-b border-sidebar-border">
                <div className="flex items-center justify-between px-4 h-16">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="text-muted-foreground hover:text-foreground hover:bg-hover"
                    >
                        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </Button>

                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Layers className="h-3.5 w-3.5 text-foreground" />
                        </div>
                        <span className="text-lg font-semibold text-foreground">PeopleFlow</span>
                    </div>

                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-hover">
                        <Bell className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-sidebar-bg backdrop-blur-2xl border-r border-sidebar-border",
                    "transform transition-transform duration-300 ease-in-out",
                    "lg:translate-x-0",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Logo */}
                <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border shrink-0">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Layers className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                    </div>
                    <div>
                        <span className="text-[15px] font-bold text-foreground tracking-tight">PeopleFlow</span>
                        <span className="block text-[10px] font-medium text-tertiary-foreground tracking-widest uppercase">Employee Portal</span>
                    </div>
                </div>

                {/* Gradient Accent */}
                <div className="h-px bg-linear-to-r from-transparent via-sidebar-accent-line to-transparent shrink-0" />

                {/* User Info Card */}
                <div className="p-4 border-b border-sidebar-border shrink-0">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-card-bg border border-card-border">
                        <Avatar className="h-10 w-10 ring-2 ring-border">
                            <AvatarImage src={user?.image || undefined} />
                            <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-foreground text-sm font-semibold">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {user?.name || "User"}
                            </p>
                            <p className="text-[11px] text-tertiary-foreground truncate">
                                {user?.email}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation — Scrollable */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
                    {navSections.map((section) => (
                        <div key={section.label}>
                            {/* Section Label */}
                            <div className="flex items-center gap-2 px-3 mb-2">
                                <span className="text-[10px] font-semibold tracking-[0.15em] text-sidebar-section-text uppercase">
                                    {locale === 'bn' ? section.labelBn : section.label}
                                </span>
                                <div className="flex-1 h-px bg-sidebar-section-divider" />
                            </div>

                            {/* Section Items */}
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const isActive = pathname === item.href;
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setIsSidebarOpen(false)}
                                            className={cn(
                                                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium",
                                                "transition-all duration-200 ease-out",
                                                isActive
                                                    ? "bg-linear-to-r from-blue-500/15 to-purple-500/10 text-foreground"
                                                    : "text-sidebar-item-text hover:text-sidebar-item-text-hover hover:bg-sidebar-item-hover"
                                            )}
                                        >
                                            {/* Active Indicator */}
                                            {isActive && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-linear-to-b from-blue-400 to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                            )}

                                            <div className={cn(
                                                "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                                                isActive
                                                    ? "bg-sidebar-icon-active-bg text-blue-400"
                                                    : "text-sidebar-item-icon group-hover:text-sidebar-item-icon-hover group-hover:bg-sidebar-item-hover"
                                            )}>
                                                <Icon className="h-[18px] w-[18px]" />
                                            </div>

                                            <span className="flex-1">{locale === 'bn' ? item.labelBn : item.label}</span>

                                            {isActive && <ChevronRight className="h-3.5 w-3.5 text-blue-400/60" />}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Bottom Section */}
                <div className="p-3 border-t border-sidebar-border space-y-1 shrink-0">
                    {/* Theme & Language */}
                    <ThemeToggle variant="compact" />
                    <LanguageSwitcher variant="compact" />

                    {/* Logout */}
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 rounded-xl text-[13px] text-tertiary-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg">
                            <LogOut className="h-[18px] w-[18px]" />
                        </div>
                        <span>{t('logout')}</span>
                    </Button>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-overlay backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="lg:pl-64 pt-16 lg:pt-0">
                <div className="p-6">{children}</div>
            </main>
        </div>
    );
}
