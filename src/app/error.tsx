"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Application error:", error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
            <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="h-10 w-10 text-red-400" />
                </div>

                <h2 className="text-2xl font-bold text-foreground mb-2">
                    Something went wrong
                </h2>

                <p className="text-muted-foreground mb-6">
                    An unexpected error occurred. Please try again or navigate back to the dashboard.
                </p>

                {error.digest && (
                    <p className="text-xs text-tertiary-foreground mb-4 font-mono">
                        Error ID: {error.digest}
                    </p>
                )}

                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Try Again
                    </button>

                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-5 py-2.5 bg-hover text-foreground rounded-xl font-medium hover:bg-card transition-colors border border-card-border"
                    >
                        <Home className="h-4 w-4" />
                        Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
