"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, LeaveType } from "@/components/leaves/types/columns"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { useToast } from "@/components/ui/toast";
export default function LeaveTypesPage() {
    const { addToast } = useToast();
    const [data, setData] = useState<LeaveType[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const t = useTranslations('Leaves')

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
                    <h1 className="text-2xl font-bold text-foreground">{t('typesTitle')}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t('typesSubtitle')}
                    </p>
                </div>
                <Link href="/leaves/types/new">
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
                        <Plus className="h-4 w-4" />
                        {t('addLeaveType')}
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
                    placeholder={t('typesSearchPlaceholder')}
                />
            )}
        </div>
    )
}
