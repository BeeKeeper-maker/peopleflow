/**
 * Platform Admin: Employee Profile Page
 *
 * Reuses the existing premium employee profile components from `/src/components/employees/`
 * while adapting them for the platform admin context (direct Prisma fetch, no tenant auth).
 *
 * This is a client-side page that fetches employee data via a platform-specific API route.
 */
"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react"
import { ProfileHeader } from "@/components/employees/profile-header"
import { ProfileStats } from "@/components/employees/profile-stats"
import { ProfileTabs } from "@/components/employees/profile-tabs"

interface PageProps {
    params: Promise<{ id: string }>
}

export default function PlatformEmployeeProfilePage({ params }: PageProps) {
    const { id } = use(params)
    const [employee, setEmployee] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchEmployee() {
            try {
                const res = await fetch(`/api/platform/employees/${id}`)
                if (!res.ok) throw new Error((await res.json()).error || "Failed to fetch")
                setEmployee(await res.json())
            } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong")
            } finally {
                setLoading(false)
            }
        }
        if (id) fetchEmployee()
    }, [id])

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    <p className="text-sm text-zinc-500">Loading employee profile...</p>
                </div>
            </div>
        )
    }

    if (error || !employee) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
                <p className="text-red-400 font-medium">{error || "Employee not found"}</p>
                <Link
                    href="/platform/employees"
                    className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-white/[0.06] hover:bg-white/[0.03] transition-all"
                >
                    ← Back to Directory
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Back Button */}
            <div className="flex items-center gap-4">
                <Link
                    href="/platform/employees"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Directory
                </Link>
            </div>

            <ProfileHeader employee={employee} />

            <div className="px-6">
                <ProfileStats employee={employee} apiBasePath="/api/platform/employees" />
                <ProfileTabs employee={employee} apiBasePath="/api/platform/employees" />
            </div>
        </div>
    )
}
