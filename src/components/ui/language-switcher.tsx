"use client";

/**
 * Language Switcher Component
 * 
 * Premium animated toggle between English and Bengali (বাংলা)
 * Features: smooth slide animation, accessible, keyboard-navigable
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
                    "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 w-full",
                    "text-[13px] font-medium",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-hover transition-all duration-200",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
                    className
                )}
                aria-label={locale === "en" ? "Switch to Bengali" : "Switch to English"}
                title={locale === "en" ? "বাংলায় পরিবর্তন করুন" : "Switch to English"}
            >
                <div className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 text-tertiary-foreground group-hover:text-blue-400">
                    <Globe className="h-[18px] w-[18px]" />
                </div>
                <div className="flex items-center gap-2 flex-1">
                    <span>{locale === "en" ? "বাংলা" : "English"}</span>
                    <div className="relative ml-auto flex items-center bg-muted rounded-full p-0.5 w-[52px] h-[24px] border border-border transition-colors">
                        <div
                            className={cn(
                                "absolute w-[20px] h-[20px] rounded-full bg-blue-500 shadow-sm transition-transform duration-300 ease-in-out",
                                locale === "bn" ? "translate-x-[27px]" : "translate-x-px"
                            )}
                        />
                        <span className={cn(
                            "relative z-10 text-[9px] font-bold w-1/2 text-center transition-colors duration-200",
                            locale === "en" ? "text-white" : "text-tertiary-foreground"
                        )}>
                            EN
                        </span>
                        <span className={cn(
                            "relative z-10 text-[9px] font-bold w-1/2 text-center transition-colors duration-200",
                            locale === "bn" ? "text-white" : "text-tertiary-foreground"
                        )}>
                            বাং
                        </span>
                    </div>
                </div>
            </button>
        );
    }

    // Default variant — for header placement
    return (
        <button
            onClick={toggleLocale}
            className={cn(
                "group relative flex items-center gap-2 rounded-xl px-3 py-2",
                "text-sm font-medium",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-hover transition-all duration-200",
                "border border-card-border",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
                className
            )}
            aria-label={locale === "en" ? "Switch to Bengali" : "Switch to English"}
            title={locale === "en" ? "বাংলায় পরিবর্তন করুন" : "Switch to English"}
        >
            <Globe className="h-4 w-4 text-tertiary-foreground group-hover:text-blue-400 transition-colors" />
            <span>{locale === "en" ? "বাংলা" : "English"}</span>
        </button>
    );
}
