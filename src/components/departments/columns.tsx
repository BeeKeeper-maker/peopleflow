"use client"

import { ColumnDef } from "@tanstack/react-table"
import { DepartmentActions } from "./department-actions"
import { Badge } from "@/components/ui/badge"

export type Department = {
    id: string
    name: string
    code: string | null
    description: string | null
    isActive: boolean
    createdAt: string
    _count: {
        employees: number
    }
}

export const columns: ColumnDef<Department>[] = [
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <div className="font-medium text-white">{row.getValue("name")}</div>,
    },
    {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => {
            const code = row.original.code
            return code ? <code className="bg-white/10 px-1 py-0.5 rounded text-xs">{code}</code> : "-"
        },
    },
    {
        accessorKey: "_count.employees",
        header: "Total Employees",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-0">
                    {row.original._count.employees} employees
                </Badge>
            </div>
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
        cell: ({ row }) => <DepartmentActions id={row.original.id} />,
    },
]
