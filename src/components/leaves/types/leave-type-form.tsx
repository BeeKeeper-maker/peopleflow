"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LeaveTypeFormValues, leaveTypeSchema } from "@/lib/validations/leave-type"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Loader2 } from "lucide-react"

interface LeaveTypeFormProps {
    initialData?: LeaveTypeFormValues & { id?: string }
    onSubmit: (data: LeaveTypeFormValues) => Promise<void>
    isLoading?: boolean
    submitLabel?: string
}

export function LeaveTypeForm({
    initialData,
    onSubmit,
    isLoading,
    submitLabel = "Save Leave Type"
}: LeaveTypeFormProps) {
    const form = useForm<LeaveTypeFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(leaveTypeSchema) as any,
        defaultValues: initialData || {
            name: "",
            code: "",
            color: "#3B82F6",
            annualAllocation: 0,
            applicableGender: "all",
            isActive: true,
            requiresDocument: false,
            encashmentAllowed: false,
            proRataEnabled: true,
        },
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Basic Info */}
                    <div className="col-span-2 space-y-4">
                        <h3 className="text-lg font-medium text-white">Basic Information</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-white">Name *</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="e.g. Annual Leave" className="bg-white/5 border-white/10" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-white">Code *</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="e.g. AL" className="bg-white/5 border-white/10" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="color"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-white">Color Key</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl>
                                                <Input {...field} type="color" className="w-12 p-1 h-10 bg-white/5 border-white/10" />
                                            </FormControl>
                                            <Input {...field} placeholder="#3B82F6" className="flex-1 bg-white/5 border-white/10" />
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="isActive"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-white">Status</FormLabel>
                                        <Select
                                            onValueChange={(value) => field.onChange(value === "true")}
                                            value={field.value ? "true" : "false"}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="true">Active</SelectItem>
                                                <SelectItem value="false">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {/* Allocation & Rules */}
                    <div className="col-span-2 space-y-4">
                        <h3 className="text-lg font-medium text-white border-t border-white/10 pt-4">Allocation Rules</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="annualAllocation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-white">Annual Days *</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="number" step="0.5" className="bg-white/5 border-white/10" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="maxAccumulation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-white">Max Carry Forward (Optional)</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="number" step="0.5" className="bg-white/5 border-white/10" />
                                        </FormControl>
                                        <FormDescription className="text-white/40">Leaves that can be carried to next year</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="applicableGender"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-white">Applicable For</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                    <SelectValue placeholder="Select gender" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="all">Check All Employees</SelectItem>
                                                <SelectItem value="male">Male Only</SelectItem>
                                                <SelectItem value="female">Female Only</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {/* Settings Toggles */}
                    <div className="col-span-2 space-y-4">
                        <h3 className="text-lg font-medium text-white border-t border-white/10 pt-4">Configuration</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="proRataEnabled"
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
                                                Pro-rata Basis
                                            </FormLabel>
                                            <FormDescription className="text-white/40">
                                                Calculate allowance based on joining date
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="requiresDocument"
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
                                                Require Documents
                                            </FormLabel>
                                            <FormDescription className="text-white/40">
                                                Employee must upload proof (e.g. medical cert)
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
