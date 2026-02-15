import { cn } from "@/lib/utils"

interface SkeletonProps {
    className?: string
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-skeleton",
                className
            )}
        />
    )
}

export function CardSkeleton() {
    return (
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <div className="flex items-center justify-between">
                <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-12 w-12 rounded-xl" />
            </div>
        </div>
    )
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <tr className="border-b border-card-border">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="py-4 px-4">
                    <Skeleton className="h-5 w-full max-w-[120px]" />
                </td>
            ))}
        </tr>
    )
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
    return (
        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
            <div className="p-6 border-b border-card-border">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
            </div>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-card-border">
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} className="py-3 px-4 text-left">
                                <Skeleton className="h-4 w-20" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <TableRowSkeleton key={i} columns={columns} />
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export function ProfileSkeleton() {
    return (
        <div className="space-y-6">
            {/* Cover */}
            <Skeleton className="h-48 w-full rounded-t-2xl" />

            {/* Profile Info */}
            <div className="px-6 pb-6">
                <div className="flex items-end gap-6 -mt-16">
                    <Skeleton className="h-32 w-32 rounded-full border-4 border-background" />
                    <div className="flex-1 pt-16 space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
            </div>
        </div>
    )
}

export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 rounded-xl border border-card-border bg-card-bg p-6">
                    <Skeleton className="h-6 w-48 mb-4" />
                    <Skeleton className="h-64 w-full" />
                </div>

                {/* Activity */}
                <div className="rounded-xl border border-card-border bg-card-bg p-6">
                    <Skeleton className="h-6 w-32 mb-4" />
                    <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function FormSkeleton() {
    return (
        <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ))}
            <div className="flex justify-end gap-3 pt-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
    )
}
