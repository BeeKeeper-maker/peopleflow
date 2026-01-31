"use client"

import { ColumnDef } from "@tanstack/react-table"
import { LeaveTypeActions } from "./leave-type-actions"
import { Badge } from "@/components/ui/badge"

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
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: row.original.color }}
                />
                <span className="font-medium text-white">{row.getValue("name")}</span>
            </div>
        ),
    },
    {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => <code className="bg-white/10 px-1 py-0.5 rounded text-xs">{row.getValue("code")}</code>,
    },
    {
        accessorKey: "annualAllocation",
        header: "Days / Year",
        cell: ({ row }) => <span className="text-white/80">{row.getValue("annualAllocation")} days</span>,
    },
    {
        accessorKey: "applicableGender",
        header: "Gender",
        cell: ({ row }) => (
            <span className="capitalize text-white/60">
                {row.getValue("applicableGender") === 'all' ? 'All' : row.getValue("applicableGender")}
            </span>
        ),
    },
    {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
            <Badge variant={row.original.isActive ? "default" : "secondary"}
                className={row.original.isActive
                    ? "bg-green-500/10 text-green-400 hover:bg-green-500/20 border-0"
                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-0"}
            >
                {row.original.isActive ? "Active" : "Inactive"}
            </Badge>
        ),
    },
    {
        id: "actions",
        cell: ({ row }) => <LeaveTypeActions id={row.original.id} />,
    },
]
