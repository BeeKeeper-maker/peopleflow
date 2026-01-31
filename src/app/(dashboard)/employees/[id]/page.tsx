"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ProfileHeader } from "@/components/employees/profile-header"
import { ProfileStats } from "@/components/employees/profile-stats"
import { ProfileTabs } from "@/components/employees/profile-tabs"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

export default function EmployeeProfilePage() {
    const params = useParams()
    const [employee, setEmployee] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchEmployee() {
            try {
                const response = await fetch(`/api/employees/${params.id}`)
                if (!response.ok) {
                    throw new Error("Failed to fetch employee")
                }
                const data = await response.json()
                setEmployee(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong")
            } finally {
                setLoading(false)
            }
        }

        if (params.id) {
            fetchEmployee()
        }
    }, [params.id])

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        )
    }

    if (error || !employee) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
                <p className="text-red-400">{error || "Employee not found"}</p>
                <Link href="/employees">
                    <Button variant="outline">Go Back</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Back Button */}
            <div className="flex items-center gap-4 mb-4">
                <Link href="/employees">
                    <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Directory
                    </Button>
                </Link>
            </div>

            <ProfileHeader employee={employee} />

            <div className="px-6">
                <ProfileStats joiningDate={employee.joiningDate} />
                <ProfileTabs employee={employee} />
            </div>
        </div>
    )
}
