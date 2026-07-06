"use client"

import { useEffect, useState } from "react"
import { LeaveCalendar } from "@/components/leaves/calendar/leave-calendar"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

export default function LeaveCalendarPage() {
    const [leaves, setLeaves] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const t = useTranslations('Leaves')

    useEffect(() => {
        const fetchLeaves = async () => {
            try {
                // Fetch approved leaves
                const response = await fetch("/api/leaves/applications?status=approved&limit=500")
                if (response.ok) {
                    const result = await response.json()
                    // API returns { data: [...], pagination: {...} } after pagination was added
                    setLeaves(Array.isArray(result) ? result : result.data || [])
                }
            } catch (error) {
                console.error("Failed to fetch leaves", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchLeaves()
    }, [])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-display font-bold text-foreground">{t('calendarTitle')}</h1>
                <p className="text-muted-foreground mt-1">
                    {t('calendarSubtitle')}
                </p>
            </div>

            {isLoading ? (
                <div className="flex h-96 items-center justify-center rounded-xl border border-card-border bg-hover">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <LeaveCalendar leaves={leaves} />
            )}
        </div>
    )
}
