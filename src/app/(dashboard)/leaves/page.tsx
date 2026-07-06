"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { columns, LeaveApplication } from "@/components/leaves/applications/columns"
import { LeaveBalanceCards } from "@/components/leaves/leave-balance-cards"
import { Button } from "@/components/ui/button"
import { Plus, Calendar, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useToast } from "@/components/ui/toast"

export default function LeaveApplicationsPage() {
    const [data, setData] = useState<LeaveApplication[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const t = useTranslations('Leaves')
    const locale = useLocale()
    const isBn = locale.startsWith('bn')
    const { addToast } = useToast()

    const fetchData = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const response = await fetch("/api/leaves/applications")
            if (response.ok) {
                const result = await response.json()
                setData(result.data || result || [])
            } else {
                const errData = await response.json().catch(() => ({}))
                const msg = errData.error || (isBn ? "ছুটির আবেদন লোড করা যায়নি" : "Failed to load leave applications")
                setError(msg)
                addToast({ title: isBn ? "ত্রুটি" : "Error", description: msg, type: "error" })
            }
        } catch (err) {
            const msg = isBn ? "নেটওয়ার্ক সমস্যা। সংযোগ পরীক্ষা করুন।" : "Network error. Please check your connection."
            setError(msg)
            addToast({ title: isBn ? "সংযোগ ত্রুটি" : "Connection Error", description: msg, type: "error" })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                            <Calendar className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t('title')}</h1>
                            <p className="text-sm text-muted-foreground">
                                {t('subtitle')}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {error && (
                        <Button variant="outline" onClick={fetchData} className="gap-2 border-card-border">
                            <RefreshCw className="h-4 w-4" />
                            {isBn ? "আবার চেষ্টা করুন" : "Retry"}
                        </Button>
                    )}
                    <Link href="/leaves/apply">
                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="h-4 w-4" />
                            {t('apply')}
                        </Button>
                    </Link>
                </div>
            </div>

            <LeaveBalanceCards />

            <DataTable
                columns={columns}
                data={data}
                searchKey="employeeName"
                placeholder={isBn ? "কর্মচারীর নাম দিয়ে খুঁজুন..." : "Search by employee name..."}
                isLoading={isLoading}
                emptyTitle={isBn ? "কোনো ছুটির আবেদন নেই" : "No leave applications"}
                emptyDescription={isBn ? "দেখানোর মতো কোনো ছুটির আবেদন নেই। আবেদন জমা হলে এখানে দেখা যাবে।" : "There are no leave applications to display. Applications will appear here once submitted."}
                emptyVariant="calendar"
            />
        </div>
    )
}
