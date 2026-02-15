"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, ChevronDown, Menu, X, LogOut, User, Settings as SettingsIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useTranslations } from 'next-intl';
import { cn } from "@/lib/utils";

interface HeaderProps {
    onMenuClick?: () => void;
    isSidebarOpen?: boolean;
}

export function Header({ onMenuClick, isSidebarOpen }: HeaderProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [showProfile, setShowProfile] = useState(false);
    const t = useTranslations('Header');
    const tb = useTranslations('Breadcrumb');

    // Real user data from session
    const userName = session?.user?.name || "User";
    const userEmail = session?.user?.email || "";
    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    // Generate breadcrumb from pathname with i18n
    const getBreadcrumb = () => {
        const paths = pathname.split("/").filter(Boolean);
        return paths.map((path, index) => {
            // Use translated label from Breadcrumb namespace
            const translated = tb(path as any);
            // If next-intl returns the full key path (e.g. "Breadcrumb.xyz"), it means key is missing
            const label = translated.includes('.')
                ? path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ")
                : translated;
            return {
                label,
                href: "/" + paths.slice(0, index + 1).join("/"),
                isLast: index === paths.length - 1,
            };
        });
    };

    const breadcrumb = getBreadcrumb();

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    return (
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-header-bg backdrop-blur-xl transition-colors duration-300">
            <div className="flex h-full items-center justify-between px-6">
                {/* Left Section */}
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden rounded-lg p-2 text-muted-foreground hover:bg-hover hover:text-foreground transition-colors"
                        aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
                    >
                        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>

                    {/* Breadcrumb */}
                    <nav className="hidden sm:flex items-center gap-2 text-sm" aria-label="Breadcrumb">
                        {breadcrumb.map((item, index) => (
                            <div key={item.href} className="flex items-center gap-2">
                                {index > 0 && <span className="text-tertiary-foreground">/</span>}
                                <span
                                    className={cn(
                                        item.isLast ? "text-foreground font-medium" : "text-muted-foreground"
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
                            placeholder={t('search')}
                            leftIcon={<Search className="h-4 w-4" />}
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Language Switcher */}
                    <LanguageSwitcher variant="compact" />

                    {/* Theme Toggle */}
                    <ThemeToggle />

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfile(!showProfile)}
                            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-hover transition-colors"
                            aria-expanded={showProfile}
                            aria-haspopup="true"
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 text-foreground text-xs font-semibold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <span className="hidden sm:block text-sm font-medium text-foreground">{userName}</span>
                            <ChevronDown className={cn(
                                "h-4 w-4 text-tertiary-foreground transition-transform duration-200",
                                showProfile && "rotate-180"
                            )} />
                        </button>

                        {showProfile && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowProfile(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-56 z-50 rounded-xl border border-border bg-dropdown shadow-2xl py-1 transition-colors duration-300">
                                    <div className="px-4 py-3 border-b border-border">
                                        <p className="text-sm font-medium text-foreground">{userName}</p>
                                        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                                    </div>
                                    <div className="py-1">
                                        <Link
                                            href="/profile"
                                            onClick={() => setShowProfile(false)}
                                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-hover hover:text-foreground transition-colors"
                                        >
                                            <User className="h-4 w-4 text-tertiary-foreground" />
                                            {t('myProfile')}
                                        </Link>
                                        <Link
                                            href="/settings"
                                            onClick={() => setShowProfile(false)}
                                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-hover hover:text-foreground transition-colors"
                                        >
                                            <SettingsIcon className="h-4 w-4 text-tertiary-foreground" />
                                            {t('settings')}
                                        </Link>
                                    </div>
                                    <div className="border-t border-border pt-1">
                                        <button
                                            onClick={handleSignOut}
                                            className="flex items-center gap-2.5 w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            {t('signOut')}
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
