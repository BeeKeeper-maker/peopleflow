"use client";

/**
 * Language Switcher Component
 * 
 * Toggle between English and Bengali (বাংলা)
 * Accessible and keyboard-navigable
 */

import { useLocale } from "@/components/providers/locale-provider";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
    variant?: "default" | "compact";
    className?: string;
}

export function LanguageSwitcher({ variant = "default", className }: LanguageSwitcherProps) {
    const { locale, setLocale } = useLocale();

    const toggleLocale = () => {
        setLocale(locale === "en" ? "bn" : "en");
    };

    if (variant === "compact") {
        return (
            <button
                onClick={toggleLocale}
                className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1.5",
                    "text-sm font-medium text-white/60 hover:text-white",
                    "hover:bg-white/10 transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    className
                )}
                aria-label={locale === "en" ? "Switch to Bengali" : "Switch to English"}
                title={locale === "en" ? "বাংলায় পরিবর্তন করুন" : "Switch to English"}
            >
                <Globe className="h-4 w-4" />
                <span className="font-semibold">
                    {locale === "en" ? "বাং" : "EN"}
                </span>
            </button>
        );
    }

    return (
        <button
            onClick={toggleLocale}
            className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2",
                "text-sm font-medium text-white/60 hover:text-white",
                "hover:bg-white/10 transition-colors border border-white/10",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                className
            )}
            aria-label={locale === "en" ? "Switch to Bengali" : "Switch to English"}
        >
            <Globe className="h-4 w-4" />
            <span>{locale === "en" ? "বাংলা" : "English"}</span>
        </button>
    );
}
