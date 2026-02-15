import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    Users,
    FileText,
    Calendar,
    Briefcase,
    FolderOpen,
    Inbox,
    Search,
    Plus
} from "lucide-react"

type EmptyStateVariant =
    | "employees"
    | "documents"
    | "calendar"
    | "jobs"
    | "files"
    | "inbox"
    | "search"
    | "default"

interface EmptyStateProps {
    variant?: EmptyStateVariant
    title: string
    description?: string
    actionLabel?: string
    onAction?: () => void
    className?: string
}

const variantIcons = {
    employees: Users,
    documents: FileText,
    calendar: Calendar,
    jobs: Briefcase,
    files: FolderOpen,
    inbox: Inbox,
    search: Search,
    default: FileText,
}

const variantGradients = {
    employees: "from-blue-500 to-indigo-600",
    documents: "from-emerald-500 to-green-600",
    calendar: "from-amber-500 to-orange-600",
    jobs: "from-purple-500 to-pink-600",
    files: "from-cyan-500 to-blue-600",
    inbox: "from-rose-500 to-red-600",
    search: "from-gray-500 to-slate-600",
    default: "from-white/10 to-white/5",
}

export function EmptyState({
    variant = "default",
    title,
    description,
    actionLabel,
    onAction,
    className,
}: EmptyStateProps) {
    const Icon = variantIcons[variant]
    const gradient = variantGradients[variant]

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center py-16 px-4 text-center",
                className
            )}
        >
            {/* Icon Container */}
            <div className={cn(
                "relative mb-6 p-6 rounded-2xl",
                "bg-linear-to-br",
                gradient,
                "opacity-20"
            )}>
                <Icon className="h-12 w-12 text-foreground" />
            </div>

            {/* Overlaid Icon for sharpness */}
            <div className="-mt-22 mb-6 relative z-10">
                <div className={cn(
                    "p-6 rounded-2xl",
                    "bg-linear-to-br",
                    gradient,
                    "shadow-lg shadow-black/20"
                )}>
                    <Icon className="h-12 w-12 text-foreground" />
                </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-semibold text-foreground mb-2">
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p className="text-muted-foreground max-w-sm mb-6">
                    {description}
                </p>
            )}

            {/* Action Button */}
            {actionLabel && onAction && (
                <Button
                    onClick={onAction}
                    className={cn(
                        "bg-linear-to-r",
                        gradient,
                        "hover:opacity-90 text-foreground"
                    )}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {actionLabel}
                </Button>
            )}
        </div>
    )
}

// Pre-configured empty states
export function NoEmployeesState({ onAdd }: { onAdd?: () => void }) {
    return (
        <EmptyState
            variant="employees"
            title="No employees found"
            description="Start building your team by adding your first employee."
            actionLabel={onAdd ? "Add Employee" : undefined}
            onAction={onAdd}
        />
    )
}

export function NoDocumentsState({ onUpload }: { onUpload?: () => void }) {
    return (
        <EmptyState
            variant="documents"
            title="No documents yet"
            description="Upload documents to keep your records organized."
            actionLabel={onUpload ? "Upload Document" : undefined}
            onAction={onUpload}
        />
    )
}

export function NoResultsState({ query }: { query?: string }) {
    return (
        <EmptyState
            variant="search"
            title="No results found"
            description={
                query
                    ? `We couldn't find anything matching "${query}". Try adjusting your search.`
                    : "Try adjusting your filters or search terms."
            }
        />
    )
}

export function NoDataState({ title = "No data available" }: { title?: string }) {
    return (
        <EmptyState
            variant="default"
            title={title}
            description="There's nothing here yet. Check back later or take action to get started."
        />
    )
}
