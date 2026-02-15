"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { LeaveTypeActions } from "./leave-type-actions"

export type LeaveType = {
    id: string
    name: string
    code: string
    color: string
    annualAllocation: number
    applicableGender: string
    isActive: boolean
}

export const columns: ColumnDef<LeaveType>[] = [
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: row.original.color }}
                />
                <span className="font-medium text-foreground">
                    {row.getValue("name")}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
            <span className="text-muted-foreground">
                {row.getValue("code")}
            </span>
        ),
    },
    {
        accessorKey: "annualAllocation",
        header: "Days / Year",
        cell: ({ row }) => {
            const days = row.getValue("annualAllocation") as number
            return (
                <span className="text-muted-foreground">
                    {days} days
                </span>
            )
        },
    },
    {
        accessorKey: "applicableGender",
        header: "Gender",
        cell: ({ row }) => {
            const gender = row.getValue("applicableGender") as string
            return (
                <span className="text-muted-foreground capitalize">
                    {gender === "all" ? "All" : gender}
                </span>
            )
        },
    },
    {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => {
            const isActive = row.getValue("isActive")
            return (
                <Badge
                    variant={isActive ? "default" : "secondary"}
                    className={isActive
                        ? "bg-green-500/10 text-green-400 hover:bg-green-500/20 border-0"
                        : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-0"
                    }
                >
                    {isActive ? "Active" : "Inactive"}
                </Badge>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <LeaveTypeActions id={row.original.id} />,
    },
]
