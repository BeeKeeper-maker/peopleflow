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
            <div className="h-48 w-full rounded-t-2xl bg-linear-to-r from-blue-600 to-purple-600 opacity-90 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
            </div>

            {/* Profile Info */}
            <div className="px-6 pb-6">
                <div className="relative flex flex-col md:flex-row items-start md:items-end -mt-16 mb-4 gap-6">
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
                    <div className="flex-1 pt-16 md:pt-0">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold text-foreground">
                                {employee.firstName} {employee.lastName}
                            </h1>
                            <Badge variant={employee.employmentStatus === 'active' ? 'success' : 'default'} className="uppercase">
                                {employee.employmentStatus}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
                            <span>{employee.designation?.name || tc("na")}</span>
                            <span className="h-1 w-1 rounded-full bg-hover"></span>
                            <span>{employee.department?.name || tc("na")}</span>
                            <span className="h-1 w-1 rounded-full bg-hover"></span>
                            <span className="font-mono">{employee.employeeCode}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
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
