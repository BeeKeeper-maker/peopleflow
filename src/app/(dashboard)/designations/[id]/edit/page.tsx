"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { DesignationForm } from "@/components/designations/designation-form"

export default function EditDesignationPage() {
    const router = useRouter()
    const params = useParams()
    const { addToast } = useToast()
    const [isFetching, setIsFetching] = useState(true)
    const [initialData, setInitialData] = useState<{
        id: string
        name: string
        code: string | null
        grade: number | null
        description: string | null
        isActive: boolean
    } | undefined>(undefined)

    useEffect(() => {
        async function fetchDesignation() {
            try {
                const response = await fetch(`/api/designations/${params.id}`)
                if (!response.ok) throw new Error("Failed to fetch designation")
                const data = await response.json()
                setInitialData({
                    id: data.id,
                    name: data.name,
                    code: data.code || null,
                    grade: data.grade || null,
                    description: data.description || null,
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
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-foreground hover:text-foreground hover:bg-hover">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">Edit Designation</h1>
                    <p className="text-muted-foreground">Update designation details</p>
                </div>
            </div>

            <div className="rounded-xl border border-card-border bg-hover p-6">
                <DesignationForm
                    initialData={initialData}
                />
            </div>
        </div>
    )
}
