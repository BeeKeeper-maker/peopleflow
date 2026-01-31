"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export type LeaveApplication = {
    id: string
    leaveType: {
        name: string
        color: string
        code: string
    }
    employee: {
        firstName: string
        lastName: string
        photoUrl: string | null
        designation?: {
            name: string
        }
    }
    fromDate: string
    toDate: string
    totalDays: number
    status: string
    reason: string | null
    createdAt: string
}

export const columns: ColumnDef<LeaveApplication>[] = [
    {
        accessorKey: "employee",
        header: "Employee",
        cell: ({ row }) => {
            const employee = row.original.employee
            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-white/10">
                        <AvatarImage src={employee.photoUrl || ""} />
                        <AvatarFallback className="bg-blue-600 text-white text-xs">
                            {employee.firstName[0]}{employee.lastName[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-medium text-white">
                            {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-xs text-white/50">
                            {employee.designation?.name || "No Designation"}
                        </div>
                    </div>
                </div>
            )
        },
    },
    {
        accessorKey: "leaveType",
        header: "Leave Type",
        cell: ({ row }) => (
            <Badge variant="outline" className="border-white/10 bg-white/5 font-normal" style={{ color: row.original.leaveType.color }}>
                {row.original.leaveType.name}
            </Badge>
        ),
    },
    {
        accessorKey: "duration",
        header: "Duration",
        cell: ({ row }) => {
            const from = new Date(row.original.fromDate)
            const to = new Date(row.original.toDate)
            return (
                <div className="flex flex-col text-sm">
                    <span className="text-white">
                        {format(from, "dd MMM")} - {format(to, "dd MMM, yyyy")}
                    </span>
                    <span className="text-xs text-white/50">
                        {row.original.totalDays} days
                    </span>
                </div>
            )
        },
    },
    {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
            <div className="max-w-[200px] truncate text-white/60" title={row.original.reason || ""}>
                {row.original.reason || "-"}
            </div>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.original.status
            let colorClass = "bg-gray-500/10 text-gray-400"

            if (status === "approved") colorClass = "bg-green-500/10 text-green-400"
            if (status === "rejected") colorClass = "bg-red-500/10 text-red-400"
            if (status === "pending") colorClass = "bg-yellow-500/10 text-yellow-400"

            return (
                <Badge variant="secondary" className={`capitalize border-0 ${colorClass} hover:${colorClass}`}>
                    {status}
                </Badge>
            )
        },
    },
]
