"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, LeaveApplication } from "@/components/leaves/applications/columns"
import { LeaveBalanceCards } from "@/components/leaves/leave-balance-cards"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"

export default function LeaveApplicationsPage() {
    const [data, setData] = useState<LeaveApplication[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/api/leaves/applications")
                if (response.ok) {
                    const result = await response.json()
                    setData(result)
                }
            } catch (error) {
                console.error("Failed to fetch leave applications", error)
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
                    <h1 className="text-2xl font-bold text-white">Leave Applications</h1>
                    <p className="text-white/60 mt-1">
                        View and manage employee leave requests
                    </p>
                </div>
                <Link href="/leaves/apply">
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="h-4 w-4" />
                        Apply for Leave
                    </Button>
                </Link>
            </div>

            <LeaveBalanceCards />

            {isLoading ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={data}
                    searchKey="employee.firstName"
                    placeholder="Search by employee name..."
                />
            )}
        </div>
    )
}
