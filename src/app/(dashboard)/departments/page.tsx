"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, Department } from "@/components/departments/columns"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { useToast } from "@/components/ui/toast";
export default function DepartmentsPage() {
    const { addToast } = useToast();
    const [data, setData] = useState<Department[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const t = useTranslations('Departments')

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
                addToast({ title: "Failed to load data. Please refresh the page.", type: "error" });
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
                    <h1 className="text-2xl font-display font-bold text-foreground">{t('title')}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t('subtitle')}
                    </p>
                </div>
                <Link href="/departments/new">
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
                        <Plus className="h-4 w-4" />
                        {t('addNew')}
                    </Button>
                </Link>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-card-border bg-hover">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={data}
                    searchKey="name"
                    placeholder={t('searchPlaceholder')}
                />
            )}
        </div>
    )
}
