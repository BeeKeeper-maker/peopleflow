"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DesignationActions } from "./designation-actions"

export type Designation = {
    id: string
    name: string
    code: string | null
    grade: number | null
    _count: {
        employees: number
    }
    isActive: boolean
}

export const columns: ColumnDef<Designation>[] = [
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
            <span className="font-medium text-foreground">
                {row.getValue("name")}
            </span>
        ),
    },
    {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
            <span className="text-muted-foreground">
                {row.getValue("code") || "—"}
            </span>
        ),
    },
    {
        accessorKey: "grade",
        header: "Grade",
        cell: ({ row }) => {
            const grade = row.getValue("grade") as number | null
            return (
                <span className="text-muted-foreground">
                    {grade ? `G-${grade}` : "—"}
                </span>
            )
        },
    },
    {
        accessorKey: "_count.employees",
        header: "Total Employees",
        cell: ({ row }) => {
            const count = row.original._count?.employees || 0
            return (
                <span className="text-muted-foreground">
                    {count}
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
        cell: ({ row }) => <DesignationActions id={row.original.id} />,
    },
]
