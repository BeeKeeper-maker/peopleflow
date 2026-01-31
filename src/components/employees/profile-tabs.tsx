"use client"

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
    // Helper to format date
    const formatDate = (dateString?: string | null) => {
        if (!dateString) return "N/A"
        try {
            return format(new Date(dateString), "MMM dd, yyyy")
        } catch (e) {
            return "Invalid Date"
        }
    }

    const currentSalary = employee.salaryAssignments?.[0]

    return (
        <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-white/5 border-b border-white/10 w-full justify-start rounded-none h-auto p-0 mb-6 overflow-x-auto">
                <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    Overview
                </TabsTrigger>
                <TabsTrigger
                    value="leave"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    Leave
                </TabsTrigger>
                <TabsTrigger
                    value="attendance"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    Attendance
                </TabsTrigger>
                <TabsTrigger
                    value="payroll"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    Payroll
                </TabsTrigger>
                <TabsTrigger
                    value="documents"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-6 py-3 border-b-2 border-transparent"
                >
                    Documents
                </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <InfoCard title="Personal Information" icon={<User className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <InfoItem label="Full Name" value={`${employee.firstName} ${employee.lastName}`} />
                            <InfoItem label="Email" value={employee.email} />
                            <InfoItem label="Phone" value={employee.phone} />
                            <InfoItem label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
                            <InfoItem label="Gender" value={employee.gender} />
                            <InfoItem label="Marital Status" value={employee.maritalStatus} />
                            <InfoItem label="Nationality" value={employee.nationality} />
                            <InfoItem label="NID" value={employee.nidNumber} />
                        </div>
                    </InfoCard>

                    {/* Employment Info */}
                    <InfoCard title="Employment Details" icon={<Briefcase className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <InfoItem label="Employee Code" value={employee.employeeCode} />
                            <InfoItem label="Joining Date" value={formatDate(employee.joiningDate)} />
                            <InfoItem label="Department" value={employee.department?.name} />
                            <InfoItem label="Designation" value={employee.designation?.name} />
                            <InfoItem label="Employment Type" value={employee.employmentType} />
                            <InfoItem label="Status" value={employee.employmentStatus} />
                            <InfoItem label="Reporting Manager" value={employee.reportingManager ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}` : "N/A"} />
                        </div>
                    </InfoCard>

                    {/* Financial Info */}
                    <InfoCard title="Financial Details" icon={<CreditCard className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <InfoItem label="Gross Salary" value={currentSalary ? `৳${currentSalary.grossSalary.toLocaleString()}` : "Not Set"} />
                            <InfoItem label="Salary Structure" value={currentSalary?.salaryStructure.name} />
                            <InfoItem label="Bank Name" value={employee.bankName} />
                            <InfoItem label="Account Number" value={employee.accountNumber} />
                        </div>
                    </InfoCard>
                </div>
            </TabsContent>

            <TabsContent value="leave">
                <div className="p-12 text-center text-white/40 border border-dashed border-white/10 rounded-xl">
                    <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-white">Leave Management</h3>
                    <p>Leave allocation and history will be displayed here.</p>
                </div>
            </TabsContent>

            <TabsContent value="attendance">
                <div className="p-12 text-center text-white/40 border border-dashed border-white/10 rounded-xl">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-white">Attendance Records</h3>
                    <p>Daily attendance logs will be displayed here.</p>
                </div>
            </TabsContent>

            <TabsContent value="payroll">
                <div className="p-12 text-center text-white/40 border border-dashed border-white/10 rounded-xl">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-white">Payroll Information</h3>
                    <p>Salary slips and tax details will be displayed here.</p>
                </div>
            </TabsContent>

            <TabsContent value="documents">
                <div className="p-12 text-center text-white/40 border border-dashed border-white/10 rounded-xl">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-white">Documents</h3>
                    <p>Employee documents will be displayed here.</p>
                </div>
            </TabsContent>
        </Tabs>
    )
}
