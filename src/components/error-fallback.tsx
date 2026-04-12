"use client";

/**
 * PeopleFlow — Enterprise Error Boundary Component
 *
 * A premium, polished error fallback used across all route groups.
 * Features:
 *   - Branded gradient background with glass morphism card
 *   - Error digest display for support reference
 *   - Retry and navigation actions
 *   - Sentry error reporting (via parent error.tsx)
 *   - Responsive design for mobile/desktop
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RotateCcw, Home, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface ErrorFallbackProps {
    error: Error & { digest?: string };
    reset: () => void;
    /** Module name for contextual messaging (e.g., "Payroll", "Attendance") */
    module?: string;
}

export function ErrorFallback({ error, reset, module }: ErrorFallbackProps) {
    const router = useRouter();

    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    const moduleLabel = module || "This section";

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4 sm:p-6">
            <div className="relative w-full max-w-lg">
                {/* Ambient glow effect */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-500/20 via-orange-500/20 to-amber-500/20 blur-xl opacity-60" />

                {/* Card */}
                <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl">
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-red-500/20 blur-md animate-pulse" />
                            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20">
                                <AlertTriangle className="w-8 h-8 text-red-400" strokeWidth={1.5} />
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-semibold text-center text-foreground mb-2">
                        Something went wrong
                    </h2>

                    {/* Contextual message */}
                    <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                        {moduleLabel} encountered an unexpected error. Our team has been
                        automatically notified and is working on a fix.
                    </p>

                    {/* Error digest badge */}
                    {error.digest && (
                        <div className="flex justify-center mb-6">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 border border-border/50">
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                    Error ID
                                </span>
                                <span className="text-xs font-mono text-muted-foreground">
                                    {error.digest}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={reset}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 active:scale-[0.98] shadow-sm"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Try Again
                        </button>
                        <button
                            onClick={() => router.back()}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-muted/50 text-muted-foreground text-sm font-medium hover:bg-muted hover:text-foreground transition-all duration-200 active:scale-[0.98] border border-border/50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Go Back
                        </button>
                    </div>

                    {/* Home link */}
                    <div className="flex justify-center mt-4">
                        <button
                            onClick={() => router.push("/")}
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Home className="w-3.5 h-3.5" />
                            Return to Home
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
