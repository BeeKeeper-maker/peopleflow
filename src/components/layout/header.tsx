"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, ChevronDown, Menu, X, LogOut, User, Settings as SettingsIcon, Command as CommandIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLocale, useTranslations } from 'next-intl';
import { cn } from "@/lib/utils";

interface HeaderProps {
    onMenuClick?: () => void;
    isSidebarOpen?: boolean;
}

/**
 * Detect dynamic route segments that should NOT be translated.
 * Matches CUIDs (cuid2), UUIDs, and purely numeric IDs.
 */
function isDynamicSegment(segment: string): boolean {
    // CUID / CUID2 (e.g. cmnu696pr001unfbos9cgzrde or clx7...)
    if (/^c[a-z0-9]{20,}$/i.test(segment)) return true;
    // UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
    // Purely numeric IDs (e.g. 123, 42)
    if (/^\d+$/.test(segment)) return true;
    return false;
}

export function Header({ onMenuClick, isSidebarOpen }: HeaderProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [showProfile, setShowProfile] = useState(false);
    const t = useTranslations('Header');
    const tb = useTranslations('Breadcrumb');
    const locale = useLocale();
    const isBn = locale.startsWith('bn');

    // Real user data from session
    const userName = session?.user?.name || "User";
    const userEmail = session?.user?.email || "";
    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    // Generate breadcrumb from pathname with i18n (safe for dynamic IDs)
    const getBreadcrumb = () => {
        const paths = pathname.split("/").filter(Boolean);
        return paths.map((path, index) => {
            // Skip translation for dynamic IDs — show "Details" instead
            if (isDynamicSegment(path)) {
                return {
                    label: "Details",
                    href: "/" + paths.slice(0, index + 1).join("/"),
                    isLast: index === paths.length - 1,
                };
            }

            // Try translation, with safe fallback for unknown keys
            let label: string;
            try {
                const translated = tb(path as any);
                // If next-intl returns the full key path (e.g. "Breadcrumb.xyz"), it means key is missing
                label = translated.includes('.')
                    ? path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ")
                    : translated;
            } catch {
                // Fallback: capitalize and de-hyphenate
                label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");
            }

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
            <div className="flex h-full min-w-0 items-center justify-between gap-3 px-4 sm:px-6">
                {/* Left Section */}
                <div className="flex min-w-0 items-center gap-4">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden rounded-lg p-2 text-muted-foreground hover:bg-hover hover:text-foreground transition-colors"
                        aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
                    >
                        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>

                    {/* Breadcrumb */}
                    <nav className="hidden min-w-0 sm:flex items-center gap-2 text-sm overflow-hidden" aria-label="Breadcrumb">
                        {breadcrumb.map((item, index) => (
                            <div key={item.href} className="flex min-w-0 items-center gap-2">
                                {index > 0 && <span className="text-tertiary-foreground">/</span>}
                                <span
                                    className={cn(
                                        "truncate max-w-[9rem] lg:max-w-[14rem]",
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
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    {/* ⌘K Command Palette Trigger (Vercel/Linear style) */}
                    <button
                        onClick={() => {
                            // Dispatch Cmd+K to open the command palette
                            const event = new KeyboardEvent('keydown', {
                                key: 'k',
                                metaKey: true,
                                bubbles: true,
                            });
                            document.dispatchEvent(event);
                        }}
                        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-card border border-border rounded-lg hover:bg-hover hover:text-foreground transition-all duration-200 cursor-pointer"
                        aria-label={isBn ? "কমান্ড প্যালেট খুলুন" : "Open command palette"}
                    >
                        <Search className="h-3.5 w-3.5" />
                        <span className="text-xs">{isBn ? "খুঁজুন..." : "Search..."}</span>
                        <kbd className="ml-1.5 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded text-muted-foreground">
                            <CommandIcon className="h-2.5 w-2.5" />K
                        </kbd>
                    </button>

                    {/* Language Switcher */}
                    <LanguageSwitcher variant="compact" />

                    {/* Theme Toggle */}
                    <ThemeToggle />

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfile(!showProfile)}
                            className="flex min-w-0 max-w-[10rem] sm:max-w-[14rem] items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-hover transition-colors"
                            aria-expanded={showProfile}
                            aria-haspopup="true"
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 text-white text-xs font-semibold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <span className="hidden sm:block min-w-0 truncate text-sm font-medium text-foreground" title={userName}>{userName}</span>
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
                                        <p className="text-sm font-medium text-foreground truncate" title={userName}>{userName}</p>
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
