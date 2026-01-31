"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LeaveApplicationFormValues, leaveApplicationSchema } from "@/lib/validations/leave-application"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface LeaveType {
    id: string
    name: string
    code: string
    annualAllocation: number
}

interface LeaveApplicationFormProps {
    onSubmit: (data: LeaveApplicationFormValues) => Promise<void>
    isLoading?: boolean
}

export function LeaveApplicationForm({
    onSubmit,
    isLoading
}: LeaveApplicationFormProps) {
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])

    // Fetch leave types for the dropdown
    useEffect(() => {
        async function fetchLeaveTypes() {
            try {
                const response = await fetch("/api/leaves/types?all=true")
                if (response.ok) {
                    const data = await response.json()
                    // Filter active ones or check applicable gender if we had user context
                    setLeaveTypes(data.filter((lt: any) => lt.isActive))
                }
            } catch (error) {
                console.error("Failed to fetch leave types", error)
            }
        }
        fetchLeaveTypes()
    }, [])

    const form = useForm<LeaveApplicationFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(leaveApplicationSchema) as any,
        defaultValues: {
            reason: "",
            halfDay: false,
        },
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="col-span-2 md:col-span-1">
                        <FormField
                            control={form.control}
                            name="leaveTypeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-white">Leave Type *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                <SelectValue placeholder="Select type of leave" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {leaveTypes.map((type) => (
                                                <SelectItem key={type.id} value={type.id}>
                                                    {type.name} ({type.annualAllocation} days/yr)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="col-span-2 grid gap-6 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="fromDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-white">From Date *</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "pl-3 text-left font-normal bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) => date < new Date("1900-01-01")}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="toDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-white">To Date *</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "pl-3 text-left font-normal bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) => date < new Date("1900-01-01")}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="col-span-2">
                        <FormField
                            control={form.control}
                            name="halfDay"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-white/10 p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel className="text-white">
                                            Apply for Half Day
                                        </FormLabel>
                                        <FormDescription className="text-white/40">
                                            If checked, only 0.5 days will be deducted (must select single date range)
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                    </div>

                    {form.watch("halfDay") && (
                        <div className="col-span-2">
                            <FormField
                                control={form.control}
                                name="halfDayType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-white">Half Day Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                    <SelectValue placeholder="Select morning or afternoon" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="first_half">First Half (Morning)</SelectItem>
                                                <SelectItem value="second_half">Second Half (Afternoon)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}

                    <div className="col-span-2">
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-white">Reason *</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            placeholder="Please provide a valid reason for your leave..."
                                            className="bg-white/5 border-white/10 text-white min-h-[100px]"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Application
                    </Button>
                </div>
            </form>
        </Form>
    )
}
