"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Search, ChevronDown, Menu, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HeaderProps {
    onMenuClick?: () => void;
    isSidebarOpen?: boolean;
}

export function Header({ onMenuClick, isSidebarOpen }: HeaderProps) {
    const pathname = usePathname();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    // Generate breadcrumb from pathname
    const getBreadcrumb = () => {
        const paths = pathname.split("/").filter(Boolean);
        return paths.map((path, index) => ({
            label: path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " "),
            href: "/" + paths.slice(0, index + 1).join("/"),
            isLast: index === paths.length - 1,
        }));
    };

    const breadcrumb = getBreadcrumb();

    return (
        <header className="sticky top-0 z-30 h-16 border-b border-white/10 bg-[#0A0A0F]/80 backdrop-blur-xl">
            <div className="flex h-full items-center justify-between px-6">
                {/* Left Section */}
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>

                    {/* Breadcrumb */}
                    <nav className="hidden sm:flex items-center gap-2 text-sm">
                        {breadcrumb.map((item, index) => (
                            <div key={item.href} className="flex items-center gap-2">
                                {index > 0 && <span className="text-white/30">/</span>}
                                <span
                                    className={cn(
                                        item.isLast ? "text-white font-medium" : "text-white/60"
                                    )}
                                >
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </nav>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="hidden md:block w-64">
                        <Input
                            placeholder="Search..."
                            leftIcon={<Search className="h-4 w-4" />}
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative rounded-xl p-2.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
                        </button>

                        {/* Notifications Dropdown */}
                        {showNotifications && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowNotifications(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-xl border border-white/10 bg-[#141419] shadow-2xl">
                                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                                        <h3 className="font-semibold text-white">Notifications</h3>
                                        <Badge variant="primary" dot>3 new</Badge>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {[
                                            {
                                                title: "Leave request pending",
                                                desc: "Ahmad Hossain has requested 3 days leave",
                                                time: "5 min ago",
                                            },
                                            {
                                                title: "Payroll processed",
                                                desc: "January 2026 payroll has been processed",
                                                time: "1 hour ago",
                                            },
                                            {
                                                title: "New employee joined",
                                                desc: "Fatima Rahman has joined the Engineering team",
                                                time: "2 hours ago",
                                            },
                                        ].map((notification, i) => (
                                            <div
                                                key={i}
                                                className="flex gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                                            >
                                                <div className="h-2 w-2 mt-2 rounded-full bg-blue-500 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-xs text-white/60 truncate">
                                                        {notification.desc}
                                                    </p>
                                                    <p className="text-xs text-white/40 mt-1">
                                                        {notification.time}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-white/10 p-2">
                                        <button className="w-full rounded-lg py-2 text-sm text-blue-400 hover:bg-white/5 transition-colors">
                                            View all notifications
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfile(!showProfile)}
                            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/10 transition-colors"
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">JD</AvatarFallback>
                            </Avatar>
                            <span className="hidden sm:block text-sm font-medium text-white">John Doe</span>
                            <ChevronDown className="h-4 w-4 text-white/40" />
                        </button>

                        {showProfile && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowProfile(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-56 z-50 rounded-xl border border-white/10 bg-[#141419] shadow-2xl py-1">
                                    <div className="px-4 py-3 border-b border-white/10">
                                        <p className="text-sm font-medium text-white">John Doe</p>
                                        <p className="text-xs text-white/60">john@company.com</p>
                                    </div>
                                    {[
                                        { label: "My Profile", href: "/profile" },
                                        { label: "Settings", href: "/settings" },
                                        { label: "Help Center", href: "/help" },
                                    ].map((item) => (
                                        <a
                                            key={item.href}
                                            href={item.href}
                                            className="block px-4 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"
                                        >
                                            {item.label}
                                        </a>
                                    ))}
                                    <div className="border-t border-white/10 mt-1 pt-1">
                                        <button className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5 transition-colors">
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
