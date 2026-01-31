"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, LeaveType } from "@/components/leaves/types/columns"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"

export default function LeaveTypesPage() {
    const [data, setData] = useState<LeaveType[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/api/leaves/types?all=true")
                if (response.ok) {
                    const result = await response.json()
                    setData(result)
                }
            } catch (error) {
                console.error("Failed to fetch leave types", error)
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
                    <h1 className="text-2xl font-bold text-white">Leave Types</h1>
                    <p className="text-white/60 mt-1">
                        Configure different types of leaves and their policies
                    </p>
                </div>
                <Link href="/leaves/types/new">
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="h-4 w-4" />
                        Add Leave Type
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
                    placeholder="Search leave types..."
                />
            )}
        </div>
    )
}
