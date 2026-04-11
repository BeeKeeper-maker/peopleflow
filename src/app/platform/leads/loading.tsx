/**
 * Loading Skeleton — /platform/leads
 *
 * Displays pulse-animated skeleton cards and table rows while
 * the Server Component fetches lead data from Prisma.
 */

export default function LeadsLoading() {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header Skeleton */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="h-7 w-44 rounded-lg bg-white/[0.06] animate-pulse" />
                    <div className="h-4 w-72 rounded-md bg-white/[0.04] animate-pulse mt-2" />
                </div>
                <div className="h-8 w-28 rounded-lg bg-indigo-500/10 border border-indigo-500/15 animate-pulse" />
            </div>

            {/* Pipeline Stats Skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                        style={{ animationDelay: `${i * 80}ms` }}
                    >
                        <div className="h-3 w-12 rounded bg-white/[0.06] animate-pulse" />
                        <div className="h-7 w-8 rounded bg-white/[0.08] animate-pulse mt-2" />
                    </div>
                ))}
            </div>

            {/* Toolbar Skeleton */}
            <div className="flex items-center gap-3">
                <div className="h-10 flex-1 max-w-sm rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
                <div className="h-10 w-28 rounded-lg bg-white/[0.03] border border-white/[0.06] animate-pulse" />
                <div className="h-10 w-28 rounded-lg bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            </div>

            {/* Table Skeleton */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                    {[60, 100, 120, 60, 70, 80, 70, 60].map((w, i) => (
                        <div
                            key={i}
                            className="h-3 rounded bg-white/[0.06] animate-pulse"
                            style={{ width: `${w}px` }}
                        />
                    ))}
                </div>

                {/* Table Rows */}
                {Array.from({ length: 8 }).map((_, rowIdx) => (
                    <div
                        key={rowIdx}
                        className="flex items-center gap-4 px-4 py-3.5 border-b border-white/[0.04]"
                        style={{ animationDelay: `${rowIdx * 60}ms` }}
                    >
                        {/* Date */}
                        <div className="w-[60px] space-y-1.5">
                            <div className="h-3 w-10 rounded bg-white/[0.06] animate-pulse" />
                            <div className="h-2.5 w-8 rounded bg-white/[0.04] animate-pulse" />
                        </div>

                        {/* Lead (avatar + name) */}
                        <div className="flex items-center gap-2 w-[100px]">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 animate-pulse shrink-0" />
                            <div className="h-3.5 w-16 rounded bg-white/[0.07] animate-pulse" />
                        </div>

                        {/* Company */}
                        <div className="h-3.5 w-[120px] rounded bg-white/[0.06] animate-pulse" />

                        {/* Size */}
                        <div className="h-6 w-[60px] rounded-md bg-white/[0.04] animate-pulse" />

                        {/* Sector */}
                        <div className="h-3.5 w-[70px] rounded bg-white/[0.05] animate-pulse" />

                        {/* Contact */}
                        <div className="flex gap-1.5">
                            <div className="w-7 h-7 rounded-md bg-white/[0.04] animate-pulse" />
                            <div className="w-7 h-7 rounded-md bg-white/[0.04] animate-pulse" />
                        </div>

                        {/* Status */}
                        <div className="h-6 w-[70px] rounded-md bg-white/[0.06] animate-pulse" />

                        {/* Source */}
                        <div className="h-5 w-[60px] rounded-full bg-white/[0.04] animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    );
}
