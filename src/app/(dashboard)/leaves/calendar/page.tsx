"use client"

import { useEffect, useState } from "react"
import { LeaveCalendar } from "@/components/leaves/calendar/leave-calendar"
import { Loader2 } from "lucide-react"

export default function LeaveCalendarPage() {
    const [leaves, setLeaves] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchLeaves = async () => {
            try {
                // Fetch approved leaves
                const response = await fetch("/api/leaves/applications?status=approved")
                if (response.ok) {
                    const data = await response.json()
                    setLeaves(data)
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
                <h1 className="text-2xl font-bold text-white">Leave Calendar</h1>
                <p className="text-white/60 mt-1">
                    Visualize team availability and scheduled leaves
                </p>
            </div>

            {isLoading ? (
                <div className="flex h-96 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <LeaveCalendar leaves={leaves} />
            )}
        </div>
    )
}
