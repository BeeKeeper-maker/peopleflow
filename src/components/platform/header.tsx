"use client";

import { useRouter } from "next/navigation";
import { LogOut, Bell, Menu } from "lucide-react";

interface AdminProfile {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface PlatformHeaderProps {
    admin: AdminProfile | null;
    onMobileMenuToggle?: () => void;
}

export function PlatformHeader({ admin, onMobileMenuToggle }: PlatformHeaderProps) {
    const router = useRouter();

    const handleLogout = async () => {
        document.cookie = "pf-platform-token=; path=/; max-age=0";
        router.push("/platform/login");
    };

    return (
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
            <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                {onMobileMenuToggle && (
                    <button
                        onClick={onMobileMenuToggle}
                        className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}
                <h2 className="text-sm font-medium text-muted-foreground">
                    Welcome back,{" "}
                    <span className="text-foreground">{admin?.name || "Admin"}</span>
                </h2>
            </div>
            <div className="flex items-center gap-3">
                {/* Notifications */}
                <button className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition-colors relative">
                    <Bell className="w-[18px] h-[18px]" />
                    <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full" />
                </button>

                {/* Admin Badge */}
                <div className="flex items-center gap-3 pl-3 border-l border-border">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
                        {admin?.name?.charAt(0) || "A"}
                    </div>
                    <div className="hidden sm:block">
                        <p className="text-sm font-medium text-foreground leading-tight">
                            {admin?.name}
                        </p>
                        <p className="text-[10px] text-indigo-400 font-medium uppercase tracking-wider">
                            {admin?.role || "admin"}
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    );
}
