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
import { useTranslations } from "next-intl"

interface LateEarlyTableProps {
    data: any[]
}

export function LateEarlyTable({ data }: LateEarlyTableProps) {
    const t = useTranslations('Reports')

    return (
        <Card className="bg-hover border-card-border text-foreground">
            <CardHeader>
                <CardTitle>{t('lateEarlyTitle')}</CardTitle>
                <CardDescription className="text-muted-foreground">
                    {t('lateEarlyDesc')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader className="bg-hover">
                        <TableRow className="border-card-border hover:bg-hover">
                            <TableHead className="text-muted-foreground">{t('employee')}</TableHead>
                            <TableHead className="text-muted-foreground">{t('department')}</TableHead>
                            <TableHead className="text-muted-foreground text-center">{t('lateCount')}</TableHead>
                            <TableHead className="text-muted-foreground text-center">{t('earlyLeaves')}</TableHead>
                            <TableHead className="text-muted-foreground text-right">{t('statusLabel')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-tertiary-foreground">
                                    {t('noRecords')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => (
                                <TableRow key={item.employee.id} className="border-card-border hover:bg-hover">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border border-card-border">
                                                <AvatarImage src={item.employee.photoUrl} alt={item.employee.firstName} />
                                                <AvatarFallback className="bg-blue-600 text-xs">
                                                    {item.employee.firstName[0]}{item.employee.lastName[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-foreground">
                                                    {item.employee.firstName} {item.employee.lastName}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {item.employee.employeeCode}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-foreground">
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
                                            <span className="text-xs text-red-400 font-medium">{t('critical')}</span>
                                        ) : item.lateCount > 2 ? (
                                            <span className="text-xs text-amber-400 font-medium">{t('warning')}</span>
                                        ) : (
                                            <span className="text-xs text-emerald-400 font-medium">{t('good')}</span>
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
