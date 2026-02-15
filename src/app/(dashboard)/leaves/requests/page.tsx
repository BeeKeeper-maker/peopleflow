"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, LeaveRequest } from "@/components/leaves/requests/columns"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

export default function LeaveRequestsPage() {
    const [data, setData] = useState<LeaveRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const t = useTranslations('Leaves')

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch only pending requests
                const response = await fetch("/api/leaves/applications?status=pending")
                if (response.ok) {
                    const result = await response.json()
                    setData(Array.isArray(result) ? result : result.data || [])
                }
            } catch (error) {
                console.error("Failed to fetch leave requests", error)
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
                    <h1 className="text-2xl font-bold text-foreground">{t('requestsTitle')}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t('requestsSubtitle')}
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-card-border bg-hover">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={data}
                    searchKey="employeeName"
                    placeholder={t('requestsSearchPlaceholder')}
                />
            )}
        </div>
    )
}
