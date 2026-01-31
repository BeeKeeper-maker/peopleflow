"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Calendar } from "lucide-react"

type LeaveAllocation = {
    leaveType: {
        id: string
        name: string
        code: string
        color: string
    }
    allocatedDays: number
    usedDays: number
    remainingDays: number
}

export function LeaveBalanceCards() {
    const [allocations, setAllocations] = useState<LeaveAllocation[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchAllocations = async () => {
            try {
                const response = await fetch("/api/leaves/allocations")
                if (response.ok) {
                    const data = await response.json()
                    setAllocations(data)
                }
            } catch (error) {
                console.error("Failed to fetch leave allocations", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchAllocations()
    }, [])

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="bg-white/5 border-white/10">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-white/50">
                                Loading...
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white/20">--</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {allocations.map((allocation) => (
                <Card key={allocation.leaveType.id} className="bg-white/5 border-white/10 overflow-hidden relative">
                    <div
                        className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 -mr-4 -mt-4 transition-transform hover:scale-110"
                        style={{ backgroundColor: allocation.leaveType.color }}
                    />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/80 z-10">
                            {allocation.leaveType.name}
                        </CardTitle>
                        <Calendar className="h-4 w-4 text-white/40 z-10" />
                    </CardHeader>
                    <CardContent className="z-10 relative">
                        <div className="text-2xl font-bold text-white">
                            {allocation.remainingDays}
                        </div>
                        <p className="text-xs text-white/50 mt-1">
                            {allocation.usedDays} days used of {allocation.allocatedDays}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
