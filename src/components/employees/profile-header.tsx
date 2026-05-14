"use client"

import { useTranslations } from "next-intl"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreVertical, Mail, Phone, MessageSquare, Edit2 } from "lucide-react"
import Link from "next/link"

interface EmployeeData {
    id: string
    firstName: string
    lastName: string
    photoUrl?: string | null
    employeeCode: string
    employmentStatus: string
    department?: { name: string } | null
    designation?: { name: string } | null
}

interface ProfileHeaderProps {
    employee: EmployeeData
}

export function ProfileHeader({ employee }: ProfileHeaderProps) {
    const t = useTranslations("SharedComponents.profileHeader")
    const tc = useTranslations("SharedComponents.common")

    return (
        <div className="relative mb-6">
            {/* Cover Image */}
            <div className="h-48 w-full rounded-t-2xl relative overflow-hidden" style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2d1b69 25%, #1a1a2e 50%, #16213e 75%, #0f3460 100%)',
            }}>
                {/* Layered gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-indigo-500/15 to-purple-600/20" />
                {/* Subtle geometric grid pattern */}
                <div className="absolute inset-0 opacity-[0.04]" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                }} />
                {/* Accent glow */}
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            {/* Profile Info */}
            <div className="px-6 pb-6">
                <div className="relative flex flex-col md:flex-row items-start md:items-end -mt-16 mb-4 gap-6 min-w-0">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="rounded-full p-1 bg-background">
                            <Avatar className="h-32 w-32 border-4 border-background">
                                {employee.photoUrl && (
                                    <AvatarImage src={employee.photoUrl} alt={`${employee.firstName} ${employee.lastName}`} />
                                )}
                                <AvatarFallback className="text-2xl">
                                    {employee.firstName[0]}{employee.lastName[0]}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        {/* Status indicator */}
                        <span className={`absolute bottom-2 right-2 h-4 w-4 rounded-full border-2 border-background ${employee.employmentStatus === 'active' ? 'bg-emerald-500' : 'bg-gray-500'
                            }`} />
                    </div>

                    {/* Name & Role */}
                    <div className="flex-1 min-w-0 pt-16 md:pt-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1 min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words min-w-0">
                                {employee.firstName} {employee.lastName}
                            </h1>
                            <Badge variant={employee.employmentStatus === 'active' ? 'success' : 'default'} className="uppercase">
                                {employee.employmentStatus}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground min-w-0">
                            <span>{employee.designation?.name || tc("na")}</span>
                            <span className="h-1 w-1 rounded-full bg-hover"></span>
                            <span>{employee.department?.name || tc("na")}</span>
                            <span className="h-1 w-1 rounded-full bg-hover"></span>
                            <span className="font-mono">{employee.employeeCode}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
                        <Button variant="outline" size="icon" className="bg-hover border-card-border hover:bg-hover">
                            <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="bg-hover border-card-border hover:bg-hover">
                            <Mail className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="bg-hover border-card-border hover:bg-hover">
                            <Phone className="h-4 w-4" />
                        </Button>
                        <Link href={`/employees/${employee.id}/edit`}>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-foreground">
                                <Edit2 className="h-4 w-4 mr-2" />
                                {t("editProfile")}
                            </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
