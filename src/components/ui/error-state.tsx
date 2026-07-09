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
 *
 * Note: The previous `EmptyState` export was a duplicate of the richer,
 * variant-based `EmptyState` in `./empty-state`. That implementation is
 * now the single source of truth — import it from `@/components/ui/empty-state`
 * (or via the barrel: `@/components/ui`).
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
