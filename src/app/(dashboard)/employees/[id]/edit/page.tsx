"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { EmployeeForm } from "@/components/employees/employee-form"
import { EmployeeFormValues, EmployeeFormInput } from "@/lib/validations/employee"

export default function EditEmployeePage() {
    const router = useRouter()
    const params = useParams()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [initialData, setInitialData] = useState<EmployeeFormInput | undefined>(undefined)
    const [isFetching, setIsFetching] = useState(true)

    useEffect(() => {
        async function fetchEmployee() {
            try {
                const response = await fetch(`/api/employees/${params.id}`)
                if (!response.ok) throw new Error("Failed to fetch employee")
                const data = await response.json()

                // Transform API data to form values
                setInitialData({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    phone: data.phone || undefined,
                    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : undefined,
                    gender: data.gender || undefined,
                    maritalStatus: data.maritalStatus || undefined,
                    nationality: data.nationality || "Bangladeshi",
                    nidNumber: data.nidNumber || undefined,

                    employeeCode: data.employeeCode,
                    departmentId: data.departmentId,
                    designationId: data.designationId,
                    joiningDate: new Date(data.joiningDate).toISOString().split('T')[0],
                    employmentType: data.employmentType,
                    employmentStatus: data.employmentStatus,
                    pfEnabled: data.pfEnabled ?? true,

                    grossSalary: data.salaryAssignments?.[0]?.grossSalary || 0,
                    bankName: data.bankName || undefined,
                    bankAccount: data.accountNumber || undefined,
                    photoUrl: data.photoUrl || undefined,
                })
            } catch (error) {
                console.error(error)
                addToast({
                    title: "Error",
                    description: "Failed to load employee data",
                    type: "error"
                })
            } finally {
                setIsFetching(false)
            }
        }

        if (params.id) fetchEmployee()
    }, [params.id, addToast])

    async function onSubmit(data: EmployeeFormValues) {
        setIsLoading(true)
        if (!params.id) {
            addToast({
                title: "Error",
                description: "Missing employee ID",
                type: "error"
            })
            setIsLoading(false)
            return
        }

        try {
            // Format dates to ISO strings for API
            const formattedData = {
                ...data,
                dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : undefined,
                joiningDate: new Date(data.joiningDate).toISOString(),
            }

            const response = await fetch(`/api/employees/${params.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formattedData),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(error)
            }

            addToast({
                title: "Success",
                description: "Employee updated successfully",
                type: "success",
            })

            router.push(`/employees/${params.id}`)
            router.refresh()
        } catch (error) {
            addToast({
                title: "Error",
                description: error instanceof Error ? error.message : "Something went wrong",
                type: "error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    if (isFetching) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href={`/employees/${params.id}`}>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Edit Employee</h1>
                    <p className="text-white/60">Update employee information</p>
                </div>
            </div>

            <EmployeeForm
                initialData={initialData}
                onSubmit={onSubmit}
                isLoading={isLoading}
                submitLabel="Update Employee"
            />
        </div>
    )
}
