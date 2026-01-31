"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { LeaveTypeForm } from "@/components/leaves/types/leave-type-form"
import { LeaveTypeFormValues } from "@/lib/validations/leave-type"

export default function NewLeaveTypePage() {
    const router = useRouter()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(data: LeaveTypeFormValues) {
        setIsLoading(true)
        try {
            const response = await fetch("/api/leaves/types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(error)
            }

            addToast({
                title: "Success",
                description: "Leave type created successfully",
                type: "success",
            })

            router.push("/leaves/types")
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
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/leaves/types">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:text-white hover:bg-white/10">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Create Leave Type</h1>
                    <p className="text-white/60">Define a new type of leave policy</p>
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <LeaveTypeForm onSubmit={onSubmit} isLoading={isLoading} />
            </div>
        </div>
    )
}
