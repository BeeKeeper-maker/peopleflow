"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    Calendar,
    Clock,
    Banknote,
    UserPlus,
    Target,
    GraduationCap,
    CreditCard,
    BarChart3,
    Building2,
    Settings,
    Bell,
    ChevronDown,
    LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: number;
    children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
    {
        label: "Dashboard",
        href: "/dashboard",
        icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
        label: "Employees",
        href: "/employees",
        icon: <Users className="h-5 w-5" />,
    },
    {
        label: "My Leaves",
        href: "/leaves",
        icon: <Calendar className="h-5 w-5" />,
    },
    {
        label: "Leave Requests",
        href: "/leaves/requests",
        icon: <Users className="h-5 w-5" />,
    },
    {
        label: "Leave Settings",
        href: "/leaves/types",
        icon: <Settings className="h-5 w-5" />,
    },
    {
        label: "Calendar",
        href: "/leaves/calendar",
        icon: <Calendar className="h-5 w-5" />,
    },
    {
        label: "Attendance",
        href: "/attendance",
        icon: <Clock className="h-5 w-5" />,
    },
    {
        label: "Payroll",
        href: "/payroll",
        icon: <Banknote className="h-5 w-5" />,
    },
    {
        label: "Recruitment",
        href: "/recruitment",
        icon: <UserPlus className="h-5 w-5" />,
    },
    {
        label: "Performance",
        href: "/performance",
        icon: <Target className="h-5 w-5" />,
    },
    {
        label: "Reports",
        href: "/reports",
        icon: <BarChart3 className="h-5 w-5" />,
    },
];

const bottomNavigation: NavItem[] = [
    {
        label: "Departments",
        href: "/departments",
        icon: <Building2 className="h-5 w-5" />,
    },
    {
        label: "Designations",
        href: "/designations",
        icon: <Target className="h-5 w-5" />,
    },
    {
        label: "Shifts",
        href: "/organization/shifts",
        icon: <Clock className="h-5 w-5" />,
    },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/10 bg-[#0A0A0F]/95 backdrop-blur-xl">
            {/* Logo */}
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                        <span className="text-lg font-bold text-white">P</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">PeopleFlow</h1>
                        <p className="text-[10px] text-white/40">HR Management System</p>
                    </div>
                </div>
                <NotificationCenter />
            </div>

            {/* Main Navigation */}
            <nav className="flex flex-col h-[calc(100vh-64px)] p-4">
                <div className="flex-1 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-white/10 text-white"
                                        : "text-white/60 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <span className={cn(isActive ? "text-blue-400" : "text-white/40")}>
                                    {item.icon}
                                </span>
                                <span className="flex-1">{item.label}</span>
                                {item.badge && (
                                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500/20 px-1.5 text-xs font-medium text-blue-400">
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Bottom Section */}
                <div className="border-t border-white/10 pt-4 space-y-1">
                    {bottomNavigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-white/10 text-white"
                                        : "text-white/60 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <span className={cn(isActive ? "text-blue-400" : "text-white/40")}>
                                    {item.icon}
                                </span>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Language Switcher */}
                <div className="border-t border-white/10 pt-3 px-1">
                    <LanguageSwitcher variant="compact" className="w-full justify-center" />
                </div>

                {/* User Profile */}
                <UserProfileSection />
            </nav>
        </aside>
    );
}

function UserProfileSection() {
    const { data: session } = useSession();

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    const userName = session?.user?.name || "User";
    const userRole = (session?.user as any)?.role || "User";
    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{userName}</p>
                    <p className="text-xs text-white/40 truncate capitalize">{userRole.replace("_", " ")}</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Logout"
                >
                    <LogOut className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
