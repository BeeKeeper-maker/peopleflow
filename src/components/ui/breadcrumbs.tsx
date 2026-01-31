"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
    label: string
    href: string
}

interface BreadcrumbsProps {
    items?: BreadcrumbItem[]
    className?: string
}

const pathToLabel: Record<string, string> = {
    dashboard: "Dashboard",
    employees: "Employees",
    departments: "Departments",
    designations: "Designations",
    attendance: "Attendance",
    leaves: "Leaves",
    payroll: "Payroll",
    reports: "Reports",
    settings: "Settings",
    organization: "Organization",
    shifts: "Shifts",
    types: "Leave Types",
    applications: "Applications",
    structures: "Salary Structures",
    new: "New",
    edit: "Edit",
    apply: "Apply Leave",
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
    const pathname = usePathname()

    // Generate breadcrumbs from pathname if items not provided
    const breadcrumbs = items || generateBreadcrumbs(pathname)

    if (breadcrumbs.length <= 1) {
        return null // Don't show breadcrumbs for root pages
    }

    return (
        <nav
            aria-label="Breadcrumb"
            className={cn("flex items-center space-x-1 text-sm", className)}
        >
            <Link
                href="/dashboard"
                className="text-white/40 hover:text-white transition-colors"
            >
                <Home className="h-4 w-4" />
            </Link>

            {breadcrumbs.map((crumb, index) => (
                <div key={crumb.href} className="flex items-center">
                    <ChevronRight className="h-4 w-4 text-white/20 mx-1" />
                    {index === breadcrumbs.length - 1 ? (
                        <span className="text-white font-medium">
                            {crumb.label}
                        </span>
                    ) : (
                        <Link
                            href={crumb.href}
                            className="text-white/40 hover:text-white transition-colors"
                        >
                            {crumb.label}
                        </Link>
                    )}
                </div>
            ))}
        </nav>
    )
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
    const segments = pathname.split("/").filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = []

    let currentPath = ""

    for (const segment of segments) {
        currentPath += `/${segment}`

        // Skip UUID-like segments (just use "Details" or similar)
        const isUuid = /^[a-zA-Z0-9]{20,}$/.test(segment)

        const label = isUuid
            ? "Details"
            : pathToLabel[segment] || capitalizeFirst(segment)

        breadcrumbs.push({
            label,
            href: currentPath,
        })
    }

    return breadcrumbs
}

function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
}
