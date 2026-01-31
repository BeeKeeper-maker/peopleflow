"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface LateEarlyTableProps {
    data: any[]
}

export function LateEarlyTable({ data }: LateEarlyTableProps) {
    return (
        <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader>
                <CardTitle>Late & Early Departures (Top 10)</CardTitle>
                <CardDescription className="text-white/60">
                    Employees with the most late arrivals or early leaves in the last 30 days.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="text-white/60">Employee</TableHead>
                            <TableHead className="text-white/60">Department</TableHead>
                            <TableHead className="text-white/60 text-center">Late Count</TableHead>
                            <TableHead className="text-white/60 text-center">Early Leaves</TableHead>
                            <TableHead className="text-white/60 text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-white/50">
                                    No records found matching criteria.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => (
                                <TableRow key={item.employee.id} className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border border-white/10">
                                                <AvatarImage src={item.employee.photoUrl} alt={item.employee.firstName} />
                                                <AvatarFallback className="bg-blue-600 text-xs">
                                                    {item.employee.firstName[0]}{item.employee.lastName[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-white">
                                                    {item.employee.firstName} {item.employee.lastName}
                                                </span>
                                                <span className="text-xs text-white/60">
                                                    {item.employee.employeeCode}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-white/80">
                                        {item.employee.department?.name || "N/A"}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10">
                                            {item.lateCount}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="border-red-500/30 text-red-500 bg-red-500/10">
                                            {item.earlyLeaveCount}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.lateCount > 5 ? (
                                            <span className="text-xs text-red-400 font-medium">Critical</span>
                                        ) : item.lateCount > 2 ? (
                                            <span className="text-xs text-amber-400 font-medium">Warning</span>
                                        ) : (
                                            <span className="text-xs text-emerald-400 font-medium">Good</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
