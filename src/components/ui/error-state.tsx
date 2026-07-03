"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
    message?: string;
    onRetry?: () => void;
    /** Icon size (default: 48) */
    iconSize?: number;
    /** Show a custom title */
    title?: string;
}

/**
 * ErrorState — a reusable error display component.
 *
 * Shows when a fetch fails or an unexpected error occurs.
 * Includes a Retry button if onRetry is provided.
 *
 * Usage:
 *   if (error) return <ErrorState message={error} onRetry={refetch} />
 */
export function ErrorState({
    message = "Something went wrong. Please try again.",
    onRetry,
    iconSize = 48,
    title = "Unable to load data",
}: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div
                className="rounded-full bg-red-500/10 flex items-center justify-center mb-4"
                style={{ width: iconSize + 24, height: iconSize + 24 }}
            >
                <AlertCircle
                    className="text-red-400"
                    style={{ width: iconSize, height: iconSize }}
                />
            </div>
            <p className="text-lg font-medium text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                {message}
            </p>
            {onRetry && (
                <Button
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={onRetry}
                >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                </Button>
            )}
        </div>
    );
}
