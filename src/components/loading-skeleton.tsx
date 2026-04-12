/**
 * PeopleFlow — Enterprise Loading Skeleton
 *
 * A premium, animated loading skeleton used across all route groups.
 * Features:
 *   - Shimmer animation with CSS only (no JS re-renders)
 *   - Responsive layout matching typical page structures
 *   - Header, stat cards, table, and sidebar skeleton blocks
 *   - Configurable variant for different page layouts
 */

interface LoadingSkeletonProps {
    /** Layout variant: "dashboard" (cards+table), "list" (header+table), "detail" (header+form) */
    variant?: "dashboard" | "list" | "detail";
}

function ShimmerBlock({ className }: { className?: string }) {
    return (
        <div
            className={`relative overflow-hidden rounded-lg bg-muted/40 ${className || ""}`}
        >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
    );
}

export function LoadingSkeleton({ variant = "dashboard" }: LoadingSkeletonProps) {
    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <ShimmerBlock className="h-7 w-48" />
                    <ShimmerBlock className="h-4 w-72" />
                </div>
                <ShimmerBlock className="h-9 w-32 rounded-md" />
            </div>

            {variant === "dashboard" && (
                <>
                    {/* Stat Cards Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-border/40 bg-card/50 p-5 space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <ShimmerBlock className="h-4 w-24" />
                                    <ShimmerBlock className="h-8 w-8 rounded-md" />
                                </div>
                                <ShimmerBlock className="h-8 w-20" />
                                <ShimmerBlock className="h-3 w-36" />
                            </div>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
                        {/* Table header */}
                        <div className="border-b border-border/30 px-5 py-3 flex gap-6">
                            <ShimmerBlock className="h-4 w-8" />
                            <ShimmerBlock className="h-4 w-32" />
                            <ShimmerBlock className="h-4 w-28" />
                            <ShimmerBlock className="h-4 w-24 hidden sm:block" />
                            <ShimmerBlock className="h-4 w-20 hidden md:block" />
                            <ShimmerBlock className="h-4 w-16 ml-auto" />
                        </div>
                        {/* Table rows */}
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="border-b border-border/20 last:border-0 px-5 py-4 flex items-center gap-6"
                            >
                                <ShimmerBlock className="h-4 w-4 rounded" />
                                <ShimmerBlock className="h-8 w-8 rounded-full flex-shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <ShimmerBlock className="h-4 w-36" />
                                    <ShimmerBlock className="h-3 w-24" />
                                </div>
                                <ShimmerBlock className="h-4 w-24 hidden sm:block" />
                                <ShimmerBlock className="h-6 w-16 rounded-full hidden md:block" />
                                <ShimmerBlock className="h-8 w-8 rounded-md ml-auto" />
                            </div>
                        ))}
                    </div>
                </>
            )}

            {variant === "list" && (
                <>
                    {/* Filters bar */}
                    <div className="flex gap-3 flex-wrap">
                        <ShimmerBlock className="h-9 w-64 rounded-md" />
                        <ShimmerBlock className="h-9 w-32 rounded-md" />
                        <ShimmerBlock className="h-9 w-28 rounded-md" />
                    </div>

                    {/* Table */}
                    <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
                        <div className="border-b border-border/30 px-5 py-3 flex gap-6">
                            <ShimmerBlock className="h-4 w-8" />
                            <ShimmerBlock className="h-4 w-40" />
                            <ShimmerBlock className="h-4 w-28" />
                            <ShimmerBlock className="h-4 w-24" />
                            <ShimmerBlock className="h-4 w-20 ml-auto" />
                        </div>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="border-b border-border/20 last:border-0 px-5 py-4 flex items-center gap-6"
                            >
                                <ShimmerBlock className="h-4 w-4 rounded" />
                                <ShimmerBlock className="h-4 w-40" />
                                <ShimmerBlock className="h-4 w-28" />
                                <ShimmerBlock className="h-4 w-20" />
                                <ShimmerBlock className="h-8 w-8 rounded-md ml-auto" />
                            </div>
                        ))}
                    </div>
                </>
            )}

            {variant === "detail" && (
                <>
                    {/* Profile header */}
                    <div className="rounded-xl border border-border/40 bg-card/50 p-6">
                        <div className="flex items-start gap-5">
                            <ShimmerBlock className="h-20 w-20 rounded-full flex-shrink-0" />
                            <div className="space-y-2.5 flex-1">
                                <ShimmerBlock className="h-6 w-48" />
                                <ShimmerBlock className="h-4 w-32" />
                                <div className="flex gap-3 pt-1">
                                    <ShimmerBlock className="h-6 w-20 rounded-full" />
                                    <ShimmerBlock className="h-6 w-24 rounded-full" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <ShimmerBlock className="h-4 w-24" />
                                <ShimmerBlock className="h-10 w-full rounded-md" />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
