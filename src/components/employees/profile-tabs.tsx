"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InfoCard, InfoItem } from "./info-card"
import { AttendanceTab } from "./profile-attendance-tab"
import { LeaveTab } from "./profile-leave-tab"
import { PayrollTab } from "./profile-payroll-tab"
import { DocumentsTab } from "./profile-documents-tab"
import { User, Briefcase, CreditCard, FileText, CalendarRange, Clock, MapPin, Heart, Globe, Shield } from "lucide-react"
import { format } from "date-fns"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ProfileTabsProps {
    employee: any
    apiBasePath?: string // Override for platform admin context
}

// Tab configuration for the premium pill-style tabs
const TAB_CONFIG = [
    { value: "overview", label: "Overview", icon: User },
    { value: "attendance", label: "Attendance", icon: Clock },
    { value: "leave", label: "Leave", icon: CalendarRange },
    { value: "payroll", label: "Payroll", icon: CreditCard },
    { value: "documents", label: "Documents", icon: Shield },
] as const

export function ProfileTabs({ employee, apiBasePath }: ProfileTabsProps) {
    const [profileData, setProfileData] = useState<any>(null)
    const [profileLoading, setProfileLoading] = useState(false)
    const [activeTab, setActiveTab] = useState("overview")

    // Fetch profile data when switching to a data tab
    useEffect(() => {
        if (activeTab === "overview" || activeTab === "documents") return
        if (profileData) return // Already fetched

        setProfileLoading(true)
        const basePath = apiBasePath || "/api/employees"
        fetch(`${basePath}/${employee.id}/profile-data`)
            .then((res) => res.json())
            .then((data) => setProfileData(data))
            .catch(console.error)
            .finally(() => setProfileLoading(false))
    }, [activeTab, employee.id, profileData, apiBasePath])

    // Helper to format date
    const formatDate = (dateString?: string | null) => {
        if (!dateString) return "N/A"
        try { return format(new Date(dateString), "MMM dd, yyyy") }
        catch { return "Invalid date" }
    }

    // Parse emergency contact
    const emergency = employee.emergencyContact
        ? (() => { try { return JSON.parse(employee.emergencyContact) } catch { return null } })()
        : null

    const currentSalary = employee.salaryAssignments?.[0]
    const hasActiveCompensation = Boolean(currentSalary?.isActive && currentSalary?.grossSalary > 0)

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* ── Premium Pill-Style Tab Bar ───────────────────────────── */}
            <TabsList className="bg-hover/50 border border-card-border rounded-xl w-full justify-start h-auto p-1.5 mb-8 overflow-x-auto gap-1 backdrop-blur-sm">
                {TAB_CONFIG.map((tab) => (
                    <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-400 data-[state=active]:border-blue-500/30 rounded-lg px-4 py-2.5 border border-transparent text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center gap-2"
                    >
                        <tab.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{tab.label}</span>
                    </TabsTrigger>
                ))}
            </TabsList>

            {/* ─────────────────────────────────────────────────────────────
                 OVERVIEW TAB — The Command Center
               ───────────────────────────────────────────────────────────── */}
            <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <InfoCard title="Personal Information" icon={<User className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <InfoItem label="Full Name" value={`${employee.firstName} ${employee.lastName}`} />
                            {employee.bengaliName && <InfoItem label="Bengali Name" value={employee.bengaliName} />}
                            <InfoItem label="Email" value={employee.email} />
                            <InfoItem label="Phone" value={employee.phone} />
                            <InfoItem label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
                            <InfoItem label="Gender" value={employee.gender} />
                            <InfoItem label="Blood Group" value={employee.bloodGroup} />
                            <InfoItem label="Marital Status" value={employee.maritalStatus} />
                            <InfoItem label="Nationality" value={employee.nationality} />
                        </div>
                    </InfoCard>

                    {/* Employment Details */}
                    <InfoCard title="Employment Details" icon={<Briefcase className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <InfoItem label="Employee Code" value={employee.employeeCode} />
                            <InfoItem label="Joining Date" value={formatDate(employee.joiningDate)} />
                            <InfoItem label="Department" value={employee.department?.name} />
                            <InfoItem label="Designation" value={employee.designation?.name} />
                            <InfoItem label="Employment Type" value={employee.employmentType} />
                            <InfoItem label="Status" value={employee.employmentStatus} />
                            <InfoItem label="Shift" value={employee.shift?.name} />
                            <InfoItem label="Reporting Manager" value={employee.reportingManager ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}` : undefined} />
                        </div>
                    </InfoCard>

                    {/* Financial Info */}
                    <InfoCard title="Financial Details" icon={<CreditCard className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <InfoItem label="Compensation Status" value={hasActiveCompensation ? "Active" : "Deferred / Not set"} />
                            {hasActiveCompensation && <InfoItem label="Gross Salary" value={`৳${currentSalary?.grossSalary.toLocaleString()}`} />}
                            {hasActiveCompensation && <InfoItem label="Salary Structure" value={currentSalary?.salaryStructure?.name} />}
                            <InfoItem label="Bank Name" value={employee.bankName} />
                            <InfoItem label="Account Number" value={employee.accountNumber} />
                            <InfoItem label="Bank Branch" value={employee.bankBranch} />
                            <InfoItem label="Routing Number" value={employee.routingNumber} />
                            <InfoItem label="TIN Number" value={employee.tinNumber} />
                            <InfoItem label="PF" value={employee.pfEnabled ? `Enabled${employee.pfNumber ? ` (${employee.pfNumber})` : ""}` : "Disabled"} />
                        </div>
                    </InfoCard>

                    {/* Address & Emergency */}
                    <div className="space-y-6">
                        <InfoCard title="Address" icon={<MapPin className="h-5 w-5" />}>
                            <div className="space-y-4">
                                <InfoItem label="Present Address" value={employee.presentAddress} />
                                <InfoItem label="Permanent Address" value={employee.permanentAddress} />
                            </div>
                        </InfoCard>

                        {emergency && (
                            <InfoCard title="Emergency Contact" icon={<Heart className="h-5 w-5" />}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                                    <InfoItem label="Name" value={emergency.name} />
                                    <InfoItem label="Phone" value={emergency.phone} />
                                    <InfoItem label="Relationship" value={emergency.relationship} />
                                </div>
                            </InfoCard>
                        )}

                        {/* Identity Docs Quick Glance */}
                        <InfoCard title="Identity Documents" icon={<Globe className="h-5 w-5" />}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                                <InfoItem label="NID Number" value={employee.nidNumber} />
                                <InfoItem label="Passport" value={employee.passportNumber} />
                                <InfoItem label="Biometric ID" value={employee.biometricUserId} />
                            </div>
                        </InfoCard>
                    </div>
                </div>
            </TabsContent>

            {/* ─────────────────────────────────────────────────────────────
                 ATTENDANCE TAB
               ───────────────────────────────────────────────────────────── */}
            <TabsContent value="attendance">
                <AttendanceTab data={profileData?.attendance || null} loading={profileLoading} />
            </TabsContent>

            {/* ─────────────────────────────────────────────────────────────
                 LEAVE TAB
               ───────────────────────────────────────────────────────────── */}
            <TabsContent value="leave">
                <LeaveTab data={profileData?.leave || null} loading={profileLoading} />
            </TabsContent>

            {/* ─────────────────────────────────────────────────────────────
                 PAYROLL TAB
               ───────────────────────────────────────────────────────────── */}
            <TabsContent value="payroll">
                <PayrollTab data={profileData?.payroll || null} loading={profileLoading} />
            </TabsContent>

            {/* ─────────────────────────────────────────────────────────────
                 DOCUMENTS TAB
               ───────────────────────────────────────────────────────────── */}
            <TabsContent value="documents">
                <DocumentsTab employee={employee} />
            </TabsContent>
        </Tabs>
    )
}
