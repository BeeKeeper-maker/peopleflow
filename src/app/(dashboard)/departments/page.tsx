"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, Department } from "@/components/departments/columns"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"

export default function DepartmentsPage() {
    const [data, setData] = useState<Department[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch all departments including inactive ones
                const response = await fetch("/api/departments?all=true")
                if (response.ok) {
                    const result = await response.json()
                    // The API returns an array directly, not { data: [] } structure based on current route.ts
                    // Wait, GET /api/departments returns `NextResponse.json(departments)` which is just the array.
                    // But GET /api/employees returns { data: ..., meta: ... }.
                    // I verified /api/departments/route.ts returns array.
                    setData(result)
                }
            } catch (error) {
                console.error("Failed to fetch departments", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Departments</h1>
                    <p className="text-white/60 mt-1">
                        Manage your organization's departments
                    </p>
                </div>
                <Link href="/departments/new">
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="h-4 w-4" />
                        Add Department
                    </Button>
                </Link>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={data}
                    searchKey="name"
                    placeholder="Search departments..."
                />
            )}
        </div>
    )
}
