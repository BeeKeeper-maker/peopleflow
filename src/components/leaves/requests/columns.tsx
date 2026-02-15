"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LeaveRequestActions } from "./leave-request-actions"

export type LeaveRequest = {
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

export const columns: ColumnDef<LeaveRequest>[] = [
    {
        id: "employeeName",
        accessorFn: (row) => `${row.employee.firstName} ${row.employee.lastName}`,
        header: "Employee",
        cell: ({ row }) => {
            const employee = row.original.employee
            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-card-border">
                        <AvatarImage src={employee.photoUrl || ""} />
                        <AvatarFallback className="bg-blue-600 text-foreground text-xs">
                            {employee.firstName[0]}{employee.lastName[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-medium text-foreground">
                            {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-xs text-tertiary-foreground">
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
            <Badge variant="default" className="border-card-border bg-hover font-normal" style={{ color: row.original.leaveType.color }}>
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
                    <span className="text-foreground">
                        {format(from, "dd MMM")} - {format(to, "dd MMM, yyyy")}
                    </span>
                    <span className="text-xs text-tertiary-foreground">
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
            <div className="max-w-[200px] truncate text-muted-foreground" title={row.original.reason || ""}>
                {row.original.reason || "-"}
            </div>
        ),
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => <LeaveRequestActions id={row.original.id} />,
    },
]
