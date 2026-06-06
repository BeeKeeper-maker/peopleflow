"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LeaveRequestActions } from "./leave-request-actions"
import { cn } from "@/lib/utils"

type LeaveRequestColumnTranslations = (key: string, values?: Record<string, string | number | Date>) => string

function formatDateRange(fromDate: string, toDate: string, locale: string) {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    const language = locale.startsWith("bn") ? "bn-BD" : "en-US"

    const shortDate = new Intl.DateTimeFormat(language, { day: "2-digit", month: "short" })
    const longDate = new Intl.DateTimeFormat(language, { day: "2-digit", month: "short", year: "numeric" })

    return `${shortDate.format(from)} - ${longDate.format(to)}`
}

function formatAppliedDate(value: string, locale: string) {
    const language = locale.startsWith("bn") ? "bn-BD" : "en-US"
    return new Intl.DateTimeFormat(language, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export type ApprovalTrail = {
    id: string
    status: string
    currentStep: number
    totalSteps: number
    currentApproverRole: string | null
    currentApprover: {
        id: string
        firstName: string
        lastName: string
        employeeCode: string
        role: string | null
        isActive: boolean | null
    } | null
    steps: Array<{
        stepNumber: number
        stepName: string
        assignedRole: string
        status: string
        assignedTo: { id: string; firstName: string; lastName: string; employeeCode: string } | null
        actedBy: { id: string; firstName: string; lastName: string; employeeCode: string } | null
        actedAt: string | null
        notes: string | null
    }>
    warnings: string[]
}

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
    approvalTrail?: ApprovalTrail | null
}

function normalizeStatus(status: string) {
    return status.toLowerCase()
}

function formatRole(role: string | null) {
    if (!role) return "Unassigned"
    return role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function personName(person: { firstName: string; lastName: string; employeeCode?: string } | null) {
    if (!person) return null
    return `${person.firstName} ${person.lastName}${person.employeeCode ? ` · ${person.employeeCode}` : ""}`
}

export function createLeaveRequestColumns(
    t: LeaveRequestColumnTranslations,
    locale: string,
    onCompleted?: () => void
): ColumnDef<LeaveRequest>[] {
    return [
        {
            id: "employeeName",
            accessorFn: (row) => [
                row.employee.firstName,
                row.employee.lastName,
                row.employee.designation?.name,
                row.leaveType.name,
                row.leaveType.code,
                row.reason,
                row.status,
                row.approvalTrail?.currentApproverRole,
                personName(row.approvalTrail?.currentApprover || null),
                row.approvalTrail?.warnings.join(" "),
            ].filter(Boolean).join(" "),
            header: t("employee"),
            cell: ({ row }) => {
                const employee = row.original.employee
                return (
                    <div className="flex items-center gap-3 min-w-[220px]">
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
                                {employee.designation?.name || t("noDesignation")}
                            </div>
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: "leaveType",
            header: t("leaveType"),
            cell: ({ row }) => (
                <Badge variant="default" className="border-card-border bg-hover font-normal" style={{ color: row.original.leaveType.color }}>
                    {row.original.leaveType.name}
                </Badge>
            ),
        },
        {
            accessorKey: "duration",
            header: t("duration"),
            cell: ({ row }) => (
                <div className="flex flex-col text-sm min-w-[145px]">
                    <span className="text-foreground">
                        {formatDateRange(row.original.fromDate, row.original.toDate, locale)}
                    </span>
                    <span className="text-xs text-tertiary-foreground">
                        {t("dayCount", { count: row.original.totalDays })}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "reason",
            header: t("reason"),
            cell: ({ row }) => (
                <div className="max-w-[220px] truncate text-muted-foreground" title={row.original.reason || ""}>
                    {row.original.reason || "-"}
                </div>
            ),
        },
        {
            accessorKey: "createdAt",
            header: t("appliedOn"),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatAppliedDate(row.original.createdAt, locale)}
                </span>
            ),
        },
        {
            id: "approvalRoute",
            header: "Approval route",
            cell: ({ row }) => {
                const trail = row.original.approvalTrail
                const status = normalizeStatus(row.original.status)
                const currentStep = trail?.steps.find((step) => step.stepNumber === trail.currentStep)
                const currentApproverName = personName(trail?.currentApprover || currentStep?.assignedTo || null)
                const hasWarning = Boolean(trail?.warnings.length)

                if (!trail) {
                    return (
                        <div className="min-w-[190px] space-y-1">
                            <Badge className="border-slate-500/25 bg-slate-500/15 text-slate-300">Legacy/direct</Badge>
                            <p className="text-xs text-muted-foreground">No approval trail found</p>
                        </div>
                    )
                }

                if (status !== "pending") {
                    const finalStep = trail.steps.find((step) => ["approved", "rejected"].includes(normalizeStatus(step.status)))
                    return (
                        <div className="min-w-[190px] space-y-1">
                            <Badge className="border-card-border bg-hover text-muted-foreground">
                                {trail.currentStep}/{trail.totalSteps} steps recorded
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                                {finalStep?.actedBy ? `Last action: ${personName(finalStep.actedBy)}` : "Decision completed"}
                            </p>
                        </div>
                    )
                }

                return (
                    <div className="min-w-[220px] space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={cn(
                                "border text-xs capitalize",
                                hasWarning
                                    ? "border-amber-500/25 bg-amber-500/15 text-amber-400"
                                    : "border-blue-500/25 bg-blue-500/15 text-blue-400"
                            )}>
                                Step {trail.currentStep}/{trail.totalSteps}: {formatRole(trail.currentApproverRole)}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {currentApproverName ? `Next: ${currentApproverName}` : "Next approver not resolved"}
                        </p>
                        {hasWarning && (
                            <p className="text-xs text-amber-400" title={trail.warnings.join("\n")}>
                                {trail.warnings[0]}
                            </p>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "status",
            header: t("status"),
            cell: ({ row }) => {
                const status = normalizeStatus(row.original.status)
                const styles = {
                    pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
                    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
                    rejected: "bg-red-500/15 text-red-400 border-red-500/25",
                    cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/25",
                }[status] || "bg-gray-500/15 text-gray-400 border-gray-500/25"

                return (
                    <Badge className={cn("capitalize", styles)}>
                        {t(status)}
                    </Badge>
                )
            },
        },
        {
            id: "actions",
            header: t("actions"),
            cell: ({ row }) => <LeaveRequestActions id={row.original.id} status={row.original.status} onCompleted={onCompleted} />,
        },
    ]
}
