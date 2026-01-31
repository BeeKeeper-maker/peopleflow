"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    Calendar,
    Clock,
    CheckSquare,
    Target,
    Bell,
    LogOut,
    Menu,
    X,
    ChevronRight,
    BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useSession, signOut } from "next-auth/react";

interface ManagerLayoutProps {
    children: ReactNode;
}

const managerNavItems = [
    {
        label: "Dashboard",
        labelBn: "ড্যাশবোর্ড",
        href: "/manager/dashboard",
        icon: LayoutDashboard,
    },
    {
        label: "My Team",
        labelBn: "আমার টিম",
        href: "/manager/team",
        icon: Users,
    },
    {
        label: "Approvals",
        labelBn: "অনুমোদন",
        href: "/manager/approvals",
        icon: CheckSquare,
        badge: 3, // Pending approvals count
    },
    {
        label: "Team Attendance",
        labelBn: "টিম উপস্থিতি",
        href: "/manager/attendance",
        icon: Clock,
    },
    {
        label: "Team Leaves",
        labelBn: "টিম ছুটি",
        href: "/manager/leaves",
        icon: Calendar,
    },
    {
        label: "Performance",
        labelBn: "কর্মক্ষমতা",
        href: "/manager/performance",
        icon: Target,
    },
    {
        label: "Reports",
        labelBn: "রিপোর্ট",
        href: "/manager/reports",
        icon: BarChart3,
    },
];

export default function ManagerLayout({ children }: ManagerLayoutProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const user = session?.user;
    const initials = user?.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "M";

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

                    <span className="text-lg font-semibold text-white">Manager Portal</span>

                    <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/5 relative">
                        <Bell className="h-5 w-5" />
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                            3
                        </span>
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
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">M</span>
                    </div>
                    <div>
                        <span className="text-white font-semibold">PeopleFlow</span>
                        <span className="block text-xs text-white/40">Manager Portal</span>
                    </div>
                </div>

                {/* User Info */}
                <div className="p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={user?.image || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.name || "Manager"}
                            </p>
                            <p className="text-xs text-orange-400 truncate">
                                Team Manager
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quick Switch to ESS */}
                <div className="p-4 border-b border-white/5">
                    <Link href="/ess/dashboard">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-white/10 text-white/60 hover:text-white hover:bg-white/5"
                        >
                            Switch to My Portal
                        </Button>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {managerNavItems.map((item) => {
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
                                        ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 text-white border border-white/10"
                                        : "text-white/60 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive && "text-orange-400")} />
                                <span className="flex-1">{item.label}</span>
                                {item.badge && (
                                    <Badge className="bg-red-500 text-white px-1.5 py-0 text-xs">
                                        {item.badge}
                                    </Badge>
                                )}
                                {isActive && <ChevronRight className="h-4 w-4 text-orange-400" />}
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
