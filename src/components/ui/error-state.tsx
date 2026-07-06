"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

/**
 * Reusable error state component for dashboard pages.
 * Shows a friendly error message with optional retry button.
 */
export function ErrorState({
    title = "Something went wrong",
    message = "We couldn't load this data. Please check your connection and try again.",
    onRetry,
}: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-2">
                {title}
            </h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                {message}
            </p>
            {onRetry && (
                <Button onClick={onRetry} variant="default" size="default">
                    <RefreshCw className="h-4 w-4" />
                    Retry
                </Button>
            )}
        </div>
    );
}

interface EmptyStateProps {
    icon?: React.ElementType;
    title: string;
    message?: string;
    action?: { label: string; href?: string; onClick?: () => void };
}

/**
 * Reusable empty state component for dashboard pages.
 * Shows when there's no data to display.
 */
export function EmptyState({
    icon: Icon,
    title,
    message,
    action,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            {Icon && (
                <div className="w-16 h-16 rounded-full bg-blue-500/5 border border-blue-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
            )}
            <h3 className="text-base font-display font-semibold text-foreground mb-1">
                {title}
            </h3>
            {message && (
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    {message}
                </p>
            )}
            {action && (action.href ? (
                <a href={action.href} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    {action.label} →
                </a>
            ) : action.onClick ? (
                <button onClick={action.onClick} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    {action.label} →
                </button>
            ) : null)}
        </div>
    );
}
