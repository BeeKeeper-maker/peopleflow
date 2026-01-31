"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { EmployeeForm } from "@/components/employees/employee-form"
import { EmployeeFormValues } from "@/lib/validations/employee"

export default function NewEmployeePage() {
    const router = useRouter()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(data: EmployeeFormValues) {
        setIsLoading(true)
        try {
            // Format dates to ISO strings for API
            const formattedData = {
                ...data,
                dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : undefined,
                joiningDate: new Date(data.joiningDate).toISOString(),
            }

            const response = await fetch("/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formattedData),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(error)
            }

            addToast({
                title: "Success",
                description: "Employee created successfully",
                type: "success",
            })

            router.push("/employees")
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

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/employees">
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Add New Employee</h1>
                    <p className="text-white/60">Create a new employee record</p>
                </div>
            </div>

            <EmployeeForm onSubmit={onSubmit} isLoading={isLoading} />
        </div>
    )
}
