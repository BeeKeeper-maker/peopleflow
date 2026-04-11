/**
 * Error Boundary — /platform/leads
 *
 * Catches runtime errors (Prisma failures, schema drift, network issues)
 * and displays a branded recovery UI instead of the default Next.js 500.
 */

"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function LeadsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Platform Leads Error]", error);
    }, [error]);

    return (
        <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(239,68,68,0.2)]">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>

                {/* Message */}
                <div>
                    <h2 className="text-xl font-bold text-white mb-2">
                        Something went wrong
                    </h2>
                    <p className="text-sm text-zinc-500 leading-relaxed">
                        The lead pipeline encountered an error. This is usually
                        temporary — try refreshing the page.
                    </p>
                </div>

                {/* Error Digest (production-safe) */}
                {error.digest && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-[10px] text-zinc-600 font-mono tracking-wider">
                            REF: {error.digest}
                        </span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                        onClick={() => window.location.href = "/platform"}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                                   bg-white/[0.04] border border-white/[0.08]
                                   text-sm text-zinc-400 font-medium
                                   hover:bg-white/[0.07] hover:text-white
                                   transition-all duration-200"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Dashboard
                    </button>
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                                   bg-gradient-to-r from-indigo-600 to-violet-600
                                   text-sm text-white font-semibold
                                   hover:shadow-[0_0_25px_-3px_rgba(99,102,241,0.5)]
                                   active:scale-[0.98] transition-all duration-200"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}
