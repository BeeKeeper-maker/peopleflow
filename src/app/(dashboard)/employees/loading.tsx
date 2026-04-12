/**
 * Loading skeleton for Employee Directory
 * Matches the premium Grid card layout
 */
export default function Loading() {
    return (
        <div className="space-y-6">
            {/* Header skeleton */}
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <div className="h-7 w-52 rounded-lg bg-white/[0.04] animate-pulse" />
                    <div className="h-4 w-80 rounded-md bg-white/[0.03] animate-pulse" />
                </div>
                <div className="h-10 w-36 rounded-xl bg-white/[0.04] animate-pulse" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-[72px] rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="h-10 flex-1 max-w-md rounded-xl bg-white/[0.03] animate-pulse" />
                <div className="h-10 w-32 rounded-lg bg-white/[0.03] animate-pulse" />
                <div className="h-10 w-24 rounded-lg bg-white/[0.03] animate-pulse" />
                <div className="flex-1" />
                <div className="h-8 w-20 rounded-lg bg-white/[0.03] animate-pulse" />
            </div>

            {/* Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-[230px] rounded-2xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
                ))}
            </div>
        </div>
    );
}
