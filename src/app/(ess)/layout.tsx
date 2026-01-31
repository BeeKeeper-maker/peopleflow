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
    Target,
    Bell,
    LogOut,
    Menu,
    X,
    ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession, signOut } from "next-auth/react";

interface ESSLayoutProps {
    children: ReactNode;
}

const essNavItems = [
    {
        label: "Dashboard",
        labelBn: "ড্যাশবোর্ড",
        href: "/ess/dashboard",
        icon: LayoutDashboard,
    },
    {
        label: "My Profile",
        labelBn: "আমার প্রোফাইল",
        href: "/ess/profile",
        icon: User,
    },
    {
        label: "My Leaves",
        labelBn: "আমার ছুটি",
        href: "/ess/leaves",
        icon: Calendar,
    },
    {
        label: "My Attendance",
        labelBn: "উপস্থিতি",
        href: "/ess/attendance",
        icon: Clock,
    },
    {
        label: "My Payslips",
        labelBn: "বেতন স্লিপ",
        href: "/ess/payslips",
        icon: Receipt,
    },
    {
        label: "My Expenses",
        labelBn: "খরচ",
        href: "/ess/expenses",
        icon: Receipt,
    },
    {
        label: "My Goals",
        labelBn: "আমার লক্ষ্য",
        href: "/ess/goals",
        icon: Target,
    },
];

export default function ESSLayout({ children }: ESSLayoutProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const user = session?.user;
    const initials = user?.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U";

    return (
        <div className="min-h-screen bg-[#0A0A0F]">
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between px-4 h-16">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="text-white/60 hover:text-white hover:bg-white/5"
                    >
                        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </Button>

                    <span className="text-lg font-semibold text-white">PeopleFlow</span>

                    <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/5">
                        <Bell className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0A0F] border-r border-white/5",
                    "transform transition-transform duration-300 ease-in-out",
                    "lg:translate-x-0",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Logo */}
                <div className="h-16 flex items-center gap-3 px-6 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">P</span>
                    </div>
                    <div>
                        <span className="text-white font-semibold">PeopleFlow</span>
                        <span className="block text-xs text-white/40">Employee Portal</span>
                    </div>
                </div>

                {/* User Info */}
                <div className="p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={user?.image || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.name || "User"}
                            </p>
                            <p className="text-xs text-white/40 truncate">
                                {user?.email}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {essNavItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                                    "transition-all duration-200",
                                    isActive
                                        ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-white/10"
                                        : "text-white/60 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive && "text-blue-400")} />
                                <span>{item.label}</span>
                                {isActive && <ChevronRight className="h-4 w-4 ml-auto text-blue-400" />}
                            </Link>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-white/5">
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-white/60 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                        <LogOut className="h-5 w-5" />
                        <span>Logout</span>
                    </Button>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
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
