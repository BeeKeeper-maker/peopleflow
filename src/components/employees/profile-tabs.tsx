"use client"

import { useTranslations } from "next-intl"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InfoCard, InfoItem } from "./info-card"
import { User, Briefcase, CreditCard, FileText, CalendarRange, Clock } from "lucide-react" // Icons
import { format } from "date-fns"

interface EmployeeData {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    dateOfBirth: string | null // ISO string from API
    gender: string | null
    maritalStatus: string | null
    nationality: string
    nidNumber: string | null

    employeeCode: string
    joiningDate: string // ISO string
    employmentType: string
    employmentStatus: string

    bankName: string | null
    accountNumber: string | null

    designation: { name: string } | null
    department: { name: string } | null
    reportingManager: { firstName: string, lastName: string } | null

    salaryAssignments: {
        grossSalary: number,
        salaryStructure: { name: string }
    }[]
}

interface ProfileTabsProps {
    employee: EmployeeData
}

export function ProfileTabs({ employee }: ProfileTabsProps) {
    const t = useTranslations("SharedComponents.profileTabs")
    const tc = useTranslations("SharedComponents.common")

    // Helper to format date
    const formatDate = (dateString?: string | null) => {
        if (!dateString) return tc("na")
        try {
            return format(new Date(dateString), "MMM dd, yyyy")
        } catch (e) {
            return t("invalidDate")
        }
    }

    const currentSalary = employee.salaryAssignments?.[0]

    return (
        <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-hover border-b border-card-border w-full justify-start rounded-none h-auto p-0 mb-6 overflow-x-auto">
                <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    {t("overview")}
                </TabsTrigger>
                <TabsTrigger
                    value="leave"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    {t("leave")}
                </TabsTrigger>
                <TabsTrigger
                    value="attendance"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    {t("attendance")}
                </TabsTrigger>
                <TabsTrigger
                    value="payroll"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    {t("payroll")}
                </TabsTrigger>
                <TabsTrigger
                    value="documents"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    {t("documents")}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <InfoCard title={t("personalInfo")} icon={<User className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <InfoItem label={t("fullName")} value={`${employee.firstName} ${employee.lastName}`} />
                            <InfoItem label={t("email")} value={employee.email} />
                            <InfoItem label={t("phone")} value={employee.phone} />
                            <InfoItem label={t("dateOfBirth")} value={formatDate(employee.dateOfBirth)} />
                            <InfoItem label={t("gender")} value={employee.gender} />
                            <InfoItem label={t("maritalStatus")} value={employee.maritalStatus} />
                            <InfoItem label={t("nationality")} value={employee.nationality} />
                            <InfoItem label={t("nid")} value={employee.nidNumber} />
                        </div>
                    </InfoCard>

                    {/* Employment Info */}
                    <InfoCard title={t("employmentDetails")} icon={<Briefcase className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <InfoItem label={t("employeeCode")} value={employee.employeeCode} />
                            <InfoItem label={t("joiningDate")} value={formatDate(employee.joiningDate)} />
                            <InfoItem label={t("department")} value={employee.department?.name} />
                            <InfoItem label={t("designation")} value={employee.designation?.name} />
                            <InfoItem label={t("employmentType")} value={employee.employmentType} />
                            <InfoItem label={t("status")} value={employee.employmentStatus} />
                            <InfoItem label={t("reportingManager")} value={employee.reportingManager ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}` : tc("na")} />
                        </div>
                    </InfoCard>

                    {/* Financial Info */}
                    <InfoCard title={t("financialDetails")} icon={<CreditCard className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <InfoItem label={t("grossSalary")} value={currentSalary ? `৳${currentSalary.grossSalary.toLocaleString()}` : tc("notSet")} />
                            <InfoItem label={t("salaryStructure")} value={currentSalary?.salaryStructure.name} />
                            <InfoItem label={t("bankName")} value={employee.bankName} />
                            <InfoItem label={t("accountNumber")} value={employee.accountNumber} />
                        </div>
                    </InfoCard>
                </div>
            </TabsContent>

            <TabsContent value="leave">
                <div className="p-12 text-center text-tertiary-foreground border border-dashed border-card-border rounded-xl">
                    <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-foreground">{t("leaveManagement")}</h3>
                    <p>{t("leaveManagementDesc")}</p>
                </div>
            </TabsContent>

            <TabsContent value="attendance">
                <div className="p-12 text-center text-tertiary-foreground border border-dashed border-card-border rounded-xl">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-foreground">{t("attendanceRecords")}</h3>
                    <p>{t("attendanceRecordsDesc")}</p>
                </div>
            </TabsContent>

            <TabsContent value="payroll">
                <div className="p-12 text-center text-tertiary-foreground border border-dashed border-card-border rounded-xl">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-foreground">{t("payrollInfo")}</h3>
                    <p>{t("payrollInfoDesc")}</p>
                </div>
            </TabsContent>

            <TabsContent value="documents">
                <div className="p-12 text-center text-tertiary-foreground border border-dashed border-card-border rounded-xl">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-foreground">{t("documentsTitle")}</h3>
                    <p>{t("documentsDesc")}</p>
                </div>
            </TabsContent>
        </Tabs>
    )
}
