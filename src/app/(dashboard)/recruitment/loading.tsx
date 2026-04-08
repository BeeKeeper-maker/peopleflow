import { TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-36 animate-pulse rounded-md bg-skeleton" />
                    <div className="h-4 w-56 animate-pulse rounded-md bg-skeleton" />
                </div>
                <div className="h-10 w-32 animate-pulse rounded-lg bg-skeleton" />
            </div>
            <TableSkeleton rows={6} columns={4} />
        </div>
    );
}
