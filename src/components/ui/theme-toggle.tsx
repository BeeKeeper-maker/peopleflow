"use client";

/**
 * Theme Toggle
 * 
 * Premium animated toggle between light/dark themes
 * Supports sidebar compact variant
 */

import { useTheme } from "@/components/providers/theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

interface ThemeToggleProps {
    variant?: "default" | "compact" | "dropdown";
    className?: string;
}

export function ThemeToggle({ variant = "default", className }: ThemeToggleProps) {
    const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
    const locale = useLocale();
    const isBn = locale.startsWith("bn");

    // Compact - simple toggle button for sidebar
    if (variant === "compact") {
        return (
            <button
                onClick={toggleTheme}
                className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 w-full",
                    "text-[13px] font-medium transition-all duration-200",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-hover",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    className
                )}
                aria-label={resolvedTheme === "dark" ? (isBn ? "লাইট মোড চালু করুন" : "Switch to light mode") : (isBn ? "ডার্ক মোড চালু করুন" : "Switch to dark mode")}
                title={resolvedTheme === "dark" ? (isBn ? "লাইট মোড চালু করুন" : "Switch to light mode") : (isBn ? "ডার্ক মোড চালু করুন" : "Switch to dark mode")}
            >
                <div className="flex items-center justify-center w-7 h-7 rounded-md">
                    {resolvedTheme === "dark" ? (
                        <Sun className="h-4 w-4 text-amber-400" />
                    ) : (
                        <Moon className="h-4 w-4 text-indigo-500" />
                    )}
                </div>
                <span>{resolvedTheme === "dark" ? (isBn ? "লাইট মোড" : "Light Mode") : (isBn ? "ডার্ক মোড" : "Dark Mode")}</span>
            </button>
        );
    }

    // Dropdown - 3 options (light, dark, system)
    if (variant === "dropdown") {
        return (
            <div className={cn("flex items-center gap-1 p-1 rounded-lg bg-card border border-border", className)}>
                {([
                    { value: "light" as const, icon: Sun, label: isBn ? "লাইট" : "Light" },
                    { value: "dark" as const, icon: Moon, label: isBn ? "ডার্ক" : "Dark" },
                    { value: "system" as const, icon: Monitor, label: isBn ? "সিস্টেম" : "System" },
                ]).map(({ value, icon: Icon, label }) => (
                    <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(
                            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200",
                            theme === value
                                ? "bg-accent text-foreground shadow-sm"
                                : "text-muted-text hover:text-foreground"
                        )}
                        aria-label={`${label} mode`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>
        );
    }

    // Default - icon button
    return (
        <button
            onClick={toggleTheme}
            className={cn(
                "relative rounded-xl p-2.5 transition-all duration-200",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-hover",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                className
            )}
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
            {resolvedTheme === "dark" ? (
                <Sun className="h-5 w-5 text-amber-400 transition-transform duration-300 hover:rotate-45" />
            ) : (
                <Moon className="h-5 w-5 text-indigo-500 transition-transform duration-300 hover:-rotate-12" />
            )}
        </button>
    );
}
