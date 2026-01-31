"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns } from "./columns"
import { Employee } from "@/types/employee"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"

export default function EmployeesPage() {
    const [data, setData] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/api/employees")
                if (response.ok) {
                    const result = await response.json()
                    setData(result.data)
                }
            } catch (error) {
                console.error("Failed to fetch employees", error)
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
                    <h1 className="text-2xl font-bold text-white">Employees</h1>
                    <p className="text-white/60 mt-1">
                        Manage your organization's workforce
                    </p>
                </div>
                <Link href="/employees/new">
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Employee
                    </Button>
                </Link>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <DataTable columns={columns} data={data} searchKey="name" placeholder="Search employees..." />
            )}
        </div>
    )
}
