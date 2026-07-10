"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { LeaveTypeForm } from "@/components/leaves/types/leave-type-form"

export default function EditLeaveTypePage() {
    const router = useRouter()
    const params = useParams()
    const { addToast } = useToast()
    const [isFetching, setIsFetching] = useState(true)
    const [initialData, setInitialData] = useState<{
        id: string
        name: string
        code: string
        color: string
        annualAllocation: number
        maxCarryForward: number | null
        applicableGender: string
        isActive: boolean
        isProRata: boolean
        requireDocument: boolean
    } | undefined>(undefined)

    useEffect(() => {
        async function fetchLeaveType() {
            try {
                const response = await fetch(`/api/leaves/types/${params.id}`)
                if (!response.ok) throw new Error("Failed to fetch leave type")
                const data = await response.json()
                setInitialData({
                    id: data.id,
                    name: data.name,
                    code: data.code,
                    color: data.color || "#3B82F6",
                    annualAllocation: data.annualAllocation,
                    maxCarryForward: data.carryForwardLimit || null,
                    applicableGender: data.applicableGender || "all",
                    isActive: data.isActive,
                    isProRata: data.proRataEnabled || false,
                    requireDocument: data.requiresDocument || false,
                })
            } catch (error) {
                console.error(error)
                addToast({
                    title: "Error",
                    description: "Failed to load leave type data",
                    type: "error"
                })
                router.push("/leaves/types")
            } finally {
                setIsFetching(false)
            }
        }

        if (params.id) fetchLeaveType()
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
                <Link href="/leaves/types">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-foreground hover:text-foreground hover:bg-hover">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">Edit Leave Type</h1>
                    <p className="text-muted-foreground">Update leave policy details</p>
                </div>
            </div>

            <div className="rounded-xl border border-card-border bg-hover p-6">
                <LeaveTypeForm
                    initialData={initialData}
                />
            </div>
        </div>
    )
}
