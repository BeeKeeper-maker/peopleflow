"use client"

import { DataTable } from "@/components/ui/data-table"
import { columns, Department } from "@/components/departments/columns"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useDepartments } from "@/hooks/use-data"

export default function DepartmentsPage() {
    const t = useTranslations('Departments')
    // ── TanStack Query: departments (including inactive) ──
    const { data = [], isLoading, isFetching, refetch, error } = useDepartments(true)
    const departments = data as Department[]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t('title')}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t('subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {error && (
                        <Button variant="outline" onClick={() => refetch()} className="gap-2 border-card-border">
                            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                            Retry
                        </Button>
                    )}
                    <Link href="/departments/new">
                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="h-4 w-4" />
                            {t('addNew')}
                        </Button>
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-card-border bg-hover">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={departments}
                    searchKey="name"
                    placeholder={t('searchPlaceholder')}
                />
            )}
        </div>
    )
}
