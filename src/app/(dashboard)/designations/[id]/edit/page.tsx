"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { DesignationForm } from "@/components/designations/designation-form"
import { DesignationFormValues } from "@/lib/validations/designation"

export default function EditDesignationPage() {
    const router = useRouter()
    const params = useParams()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [isFetching, setIsFetching] = useState(true)
    const [initialData, setInitialData] = useState<DesignationFormValues | undefined>(undefined)

    useEffect(() => {
        async function fetchDesignation() {
            try {
                const response = await fetch(`/api/designations/${params.id}`)
                if (!response.ok) throw new Error("Failed to fetch designation")
                const data = await response.json()
                setInitialData({
                    name: data.name,
                    code: data.code || "",
                    grade: data.grade || undefined,
                    description: data.description || "",
                    isActive: data.isActive,
                })
            } catch (error) {
                console.error(error)
                addToast({
                    title: "Error",
                    description: "Failed to load designation data",
                    type: "error"
                })
                router.push("/designations")
            } finally {
                setIsFetching(false)
            }
        }

        if (params.id) fetchDesignation()
    }, [params.id, addToast, router])

    async function onSubmit(data: DesignationFormValues) {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/designations/${params.id}`, {
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
                description: "Designation updated successfully",
                type: "success",
            })

            router.push("/designations")
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
                <Link href="/designations">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:text-white hover:bg-white/10">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Edit Designation</h1>
                    <p className="text-white/60">Update designation details</p>
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <DesignationForm
                    initialData={initialData}
                    onSubmit={onSubmit}
                    isLoading={isLoading}
                    submitLabel="Update Designation"
                />
            </div>
        </div>
    )
}
