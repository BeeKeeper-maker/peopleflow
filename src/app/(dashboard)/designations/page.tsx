"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, Designation } from "@/components/designations/columns"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

export default function DesignationsPage() {
    const [data, setData] = useState<Designation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const t = useTranslations('Designations')

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch all designations including inactive ones
                const response = await fetch("/api/designations?all=true")
                if (response.ok) {
                    const result = await response.json()
                    setData(result)
                }
            } catch (error) {
                console.error("Failed to fetch designations", error)
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
                <Link href="/designations/new">
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
