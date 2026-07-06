"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { DepartmentForm } from "@/components/departments/department-form"

export default function EditDepartmentPage() {
    const router = useRouter()
    const params = useParams()
    const { addToast } = useToast()
    const [isFetching, setIsFetching] = useState(true)
    const [initialData, setInitialData] = useState<{
        id: string
        name: string
        code: string | null
        description: string | null
        isActive: boolean
    } | undefined>(undefined)

    useEffect(() => {
        async function fetchDepartment() {
            try {
                const response = await fetch(`/api/departments/${params.id}`)
                if (!response.ok) throw new Error("Failed to fetch department")
                const data = await response.json()
                setInitialData({
                    id: data.id,
                    name: data.name,
                    code: data.code || null,
                    description: data.description || null,
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
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-foreground hover:text-foreground hover:bg-hover">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">Edit Department</h1>
                    <p className="text-muted-foreground">Update department details</p>
                </div>
            </div>

            <div className="rounded-xl border border-card-border bg-hover p-6">
                <DepartmentForm
                    initialData={initialData}
                />
            </div>
        </div>
    )
}
