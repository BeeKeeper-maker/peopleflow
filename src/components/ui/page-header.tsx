"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    iconColor?: string; // e.g., "blue", "emerald", "amber", "red", "purple", "primary"
    actions?: React.ReactNode;
    className?: string;
}

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: "bg-blue-500/15", text: "text-blue-400", ring: "ring-blue-500/20" },
    emerald: { bg: "bg-emerald-500/15", text: "text-emerald-400", ring: "ring-emerald-500/20" },
    amber: { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/20" },
    red: { bg: "bg-red-500/15", text: "text-red-400", ring: "ring-red-500/20" },
    purple: { bg: "bg-purple-500/15", text: "text-purple-400", ring: "ring-purple-500/20" },
    primary: { bg: "bg-primary/15", text: "text-primary", ring: "ring-primary/20" },
};

export function PageHeader({
    title,
    subtitle,
    icon: Icon,
    iconColor = "primary",
    actions,
    className,
}: PageHeaderProps) {
    const colors = COLOR_MAP[iconColor] || COLOR_MAP.primary;

    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", className)}>
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl ring-1",
                        colors.bg,
                        colors.ring,
                    )}>
                        <Icon className={cn("h-5 w-5", colors.text)} />
                    </div>
                )}
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{title}</h1>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-2 flex-wrap">{actions}</div>
            )}
        </div>
    );
}
