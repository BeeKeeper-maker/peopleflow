"use client"

import { useState, useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { LeaveApplicationFormValues, leaveApplicationSchema } from "@/lib/validations/leave-application"
import { Button } from "@/components/ui/button"
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
    nameBn?: string | null
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
    const t = useTranslations("SharedComponents.leaveApplicationForm")

    // Fetch leave types for the dropdown
    useEffect(() => {
        async function fetchLeaveTypes() {
            try {
                const response = await fetch("/api/leaves/types?all=true")
                if (response.ok) {
                    const data = await response.json()
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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


    const isHalfDay = useWatch({ control: form.control, name: "halfDay" })
    const fromDate = useWatch({ control: form.control, name: "fromDate" })

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
                                    <FormLabel className="text-foreground">{t("leaveTypeLabel")}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-hover border-card-border text-foreground">
                                                <SelectValue placeholder={t("selectLeaveType")} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {leaveTypes.map((type) => (
                                                <SelectItem key={type.id} value={type.id}>
                                                    {type.nameBn || type.name} ({t("daysPerYear", { count: type.annualAllocation })})
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
                                    <FormLabel className="text-foreground">{t("fromDate")}</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "pl-3 text-left font-normal bg-hover border-card-border text-foreground hover:bg-hover hover:text-foreground",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>{t("pickDate")}</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={(date) => {
                                                    field.onChange(date)
                                                    if (date && form.getValues("halfDay")) {
                                                        form.setValue("toDate", date, { shouldValidate: true })
                                                    }
                                                }}
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
                                    <FormLabel className="text-foreground">{t("toDate")}</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "pl-3 text-left font-normal bg-hover border-card-border text-foreground hover:bg-hover hover:text-foreground",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>{t("pickDate")}</span>
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
                                                disabled={(date) => date < new Date("1900-01-01") || (fromDate ? date < fromDate : false) || isHalfDay}
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
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-card-border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={(checked) => {
                                                field.onChange(checked)
                                                if (checked && form.getValues("fromDate")) {
                                                    form.setValue("toDate", form.getValues("fromDate"), { shouldValidate: true })
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel className="text-foreground">
                                            {t("halfDay")}
                                        </FormLabel>
                                        <FormDescription className="text-tertiary-foreground">
                                            {t("halfDayDesc")}
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                    </div>

                    {isHalfDay && (
                        <div className="col-span-2">
                            <FormField
                                control={form.control}
                                name="halfDayType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground">{t("halfDayType")}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-hover border-card-border text-foreground">
                                                    <SelectValue placeholder={t("selectHalfDayType")} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="first_half">{t("firstHalf")}</SelectItem>
                                                <SelectItem value="second_half">{t("secondHalf")}</SelectItem>
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
                                    <FormLabel className="text-foreground">{t("reasonLabel")}</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            placeholder={t("reasonPlaceholder")}
                                            className="bg-hover border-card-border text-foreground min-h-[100px]"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-card-border">
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-foreground"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t("submitApplication")}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
