"use client"

import { useState } from "react"
import { DayPicker } from "react-day-picker"
import { format, isSameDay } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
// import "react-day-picker/dist/style.css" // We will style manually or use text classes

type LeaveEvent = {
    id: string
    employee: {
        firstName: string
        lastName: string
        photoUrl: string | null
    }
    leaveType: {
        name: string
        color: string
    }
    fromDate: Date
    toDate: Date
    status: string
}

interface LeaveCalendarProps {
    leaves: LeaveEvent[]
}

export function LeaveCalendar({ leaves }: LeaveCalendarProps) {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

    // Helper to check if a day has leave
    const getLeavesForDay = (day: Date) => {
        return leaves.filter(leave => {
            const start = new Date(leave.fromDate)
            const end = new Date(leave.toDate)
            return day >= start && day <= end
        })
    }

    const modifiers = {
        hasLeave: (date: Date) => getLeavesForDay(date).length > 0
    }

    const modifiersStyles = {
        hasLeave: {
            fontWeight: 'bold',
            color: 'var(--color-primary-400)' // Using our global variable
        }
    }

    const selectedDayLeaves = selectedDate ? getLeavesForDay(selectedDate) : []

    return (
        <div className="grid md:grid-cols-[1fr_300px] gap-6">
            <Card className="bg-hover border-card-border">
                <CardContent className="p-4 flex justify-center">
                    <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        modifiers={modifiers}
                        modifiersStyles={modifiersStyles}
                        className={cn("p-3 text-foreground")}
                        classNames={{
                            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                            month: "space-y-4",
                            caption: "flex justify-center pt-1 relative items-center",
                            caption_label: "text-sm font-medium",
                            nav: "space-x-1 flex items-center",
                            nav_button: cn(
                                "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-foreground"
                            ),
                            nav_button_previous: "absolute left-1",
                            nav_button_next: "absolute right-1",
                            table: "w-full border-collapse space-y-1",
                            head_row: "flex",
                            head_cell:
                                "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                            row: "flex w-full mt-2",
                            cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                            day: cn(
                                "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-hover rounded-md text-foreground"
                            ),
                            day_range_end: "day-range-end",
                            day_selected:
                                "bg-blue-600 text-foreground hover:bg-blue-600 hover:text-foreground focus:bg-blue-600 focus:text-foreground",
                            day_today: "bg-hover text-foreground font-bold",
                            day_outside:
                                "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                            day_disabled: "text-muted-foreground opacity-50",
                            day_range_middle:
                                "aria-selected:bg-accent aria-selected:text-accent-foreground",
                            day_hidden: "invisible",
                        }}
                    />
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                    On Leave ({selectedDate ? format(selectedDate, "MMM dd") : "Select a date"})
                </h3>

                {selectedDayLeaves.length === 0 ? (
                    <div className="text-center py-8 text-tertiary-foreground bg-hover rounded-xl border border-card-border">
                        <p>No leaves regarding this date</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {selectedDayLeaves.map(leave => (
                            <div key={leave.id} className="flex items-center gap-3 p-3 rounded-xl bg-hover border border-card-border">
                                <Avatar className="h-10 w-10 border border-card-border">
                                    <AvatarImage src={leave.employee.photoUrl || undefined} />
                                    <AvatarFallback>
                                        {leave.employee.firstName[0]}{leave.employee.lastName[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-foreground">
                                        {leave.employee.firstName} {leave.employee.lastName}
                                    </p>
                                    <Badge
                                        variant="default"
                                        className="mt-1 border-0 bg-hover"
                                        style={{ color: leave.leaveType.color }}
                                    >
                                        {leave.leaveType.name}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
