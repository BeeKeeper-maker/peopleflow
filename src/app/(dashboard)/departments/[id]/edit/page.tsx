"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { DepartmentForm } from "@/components/departments/department-form"
import { DepartmentFormValues } from "@/lib/validations/department"

export default function EditDepartmentPage() {
    const router = useRouter()
    const params = useParams()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [isFetching, setIsFetching] = useState(true)
    const [initialData, setInitialData] = useState<DepartmentFormValues | undefined>(undefined)

    useEffect(() => {
        async function fetchDepartment() {
            try {
                const response = await fetch(`/api/departments/${params.id}`)
                if (!response.ok) throw new Error("Failed to fetch department")
                const data = await response.json()
                setInitialData({
                    name: data.name,
                    code: data.code || "",
                    description: data.description || "",
                    isActive: data.isActive,
                })
            } catch (error) {
                console.error(error)
                addToast({
                    title: "Error",
                    description: "Failed to load department data",
                    type: "error"
                })
                router.push("/departments")
            } finally {
                setIsFetching(false)
            }
        }

        if (params.id) fetchDepartment()
    }, [params.id, addToast, router])

    async function onSubmit(data: DepartmentFormValues) {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/departments/${params.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(error)
            }

            addToast({
                title: "Success",
                description: "Department updated successfully",
                type: "success",
            })

            router.push("/departments")
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
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/departments">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:text-white hover:bg-white/10">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Edit Department</h1>
                    <p className="text-white/60">Update department details</p>
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <DepartmentForm
                    initialData={initialData}
                    onSubmit={onSubmit}
                    isLoading={isLoading}
                    submitLabel="Update Department"
                />
            </div>
        </div>
    )
}
