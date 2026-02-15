"use client";

/**
 * Skip to Content Link
 * 
 * Accessibility feature for keyboard users
 * Hidden until focused with Tab key
 */

import { cn } from "@/lib/utils";

interface SkipLinkProps {
    href?: string;
    children?: React.ReactNode;
    className?: string;
}

export function SkipLink({
    href = "#main-content",
    children = "Skip to main content",
    className
}: SkipLinkProps) {
    return (
        <a
            href={href}
            className={cn(
                // Hidden by default
                "sr-only",
                // Visible on focus
                "focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]",
                "focus:px-4 focus:py-2 focus:rounded-lg",
                "focus:bg-blue-600 focus:text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2",
                "focus:shadow-lg",
                "font-medium text-sm",
                className
            )}
        >
            {children}
        </a>
    );
}
