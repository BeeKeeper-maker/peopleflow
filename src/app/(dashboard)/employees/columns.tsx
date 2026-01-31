"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Employee } from "@/types/employee"
import { EmployeeActions } from "./employee-actions"

export const columns: ColumnDef<Employee>[] = [
    {
        accessorKey: "employeeCode",
        header: "ID",
        cell: ({ row }) => (
            <span className="font-mono text-xs text-white/60">
                {row.getValue("employeeCode")}
            </span>
        ),
    },
    {
        accessorKey: "name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8 data-[state=open]:bg-accent"
                >
                    Employee
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const employee = row.original
            const fullName = `${employee.firstName} ${employee.lastName}`
            const initials = `${employee.firstName[0]}${employee.lastName[0]}`

            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-white/10">
                        <AvatarImage src={employee.photoUrl || undefined} alt={fullName} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium text-white">{fullName}</span>
                        <span className="text-xs text-white/40">{employee.email}</span>
                    </div>
                </div>
            )
        },
    },
    {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => {
            const department = row.original.department
            return (
                <span className="text-white/80">
                    {department?.name || "-"}
                </span>
            )
        },
    },
    {
        accessorKey: "designation",
        header: "Designation",
        cell: ({ row }) => {
            const designation = row.original.designation
            return (
                <span className="text-white/80">
                    {designation?.name || "-"}
                </span>
            )
        },
    },
    {
        accessorKey: "employmentType",
        header: "Type",
        cell: ({ row }) => {
            const type = row.getValue("employmentType") as string
            return (
                <span className="capitalize text-white/60">
                    {type}
                </span>
            )
        },
    },
    {
        accessorKey: "employmentStatus",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("employmentStatus") as string
            return (
                <Badge
                    variant={
                        status === "active"
                            ? "success"
                            : status === "resigned"
                                ? "warning"
                                : "danger"
                    }
                    className="capitalize"
                    dot
                >
                    {status}
                </Badge>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <EmployeeActions employee={row.original} />,
    },
]
