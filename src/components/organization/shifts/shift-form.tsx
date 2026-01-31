"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { Clock } from "lucide-react"

const shiftSchema = z.object({
    name: z.string().min(1, "Name is required"),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Sort format HH:mm required"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Sort format HH:mm required"),
    breakDuration: z.coerce.number().min(0, "Must be positive"),
    graceMinutes: z.coerce.number().min(0, "Must be positive"),
    halfDayHours: z.coerce.number().min(0, "Must be positive"),
    fullDayHours: z.coerce.number().min(0, "Must be positive"),
    isDefault: z.boolean().default(false),
})

type ShiftFormValues = z.infer<typeof shiftSchema>

interface ShiftFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: any
    onSuccess: () => void
}

export function ShiftForm({ open, onOpenChange, initialData, onSuccess }: ShiftFormProps) {
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<ShiftFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(shiftSchema) as any,
        defaultValues: initialData || {
            name: "",
            startTime: "09:00",
            endTime: "18:00",
            breakDuration: 60,
            graceMinutes: 15,
            halfDayHours: 4,
            fullDayHours: 8,
            isDefault: false,
        },
    })

    const onSubmit = async (data: ShiftFormValues) => {
        setIsLoading(true)
        try {
            const url = initialData ? `/api/shifts/${initialData.id}` : "/api/shifts"
            const method = initialData ? "PUT" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const error = await res.text()
                throw new Error(error)
            }

            addToast({
                title: initialData ? "Shift updated" : "Shift created",
                type: "success"
            })
            onSuccess()
            onOpenChange(false)
            form.reset()
        } catch (error) {
            console.error(error)
            addToast({
                title: "Error",
                description: "Something went wrong",
                type: "error"
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-[#1E293B] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Edit Shift" : "Create New Shift"}</DialogTitle>
                    <DialogDescription className="text-white/60">
                        Define working hours and rules for this shift.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Shift Name</label>
                        <Input {...form.register("name")} placeholder="e.g. General Shift" className="bg-white/5 border-white/10" />
                        {form.formState.errors.name && (
                            <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Start Time</label>
                            <div className="relative">
                                <Input type="time" {...form.register("startTime")} className="bg-white/5 border-white/10 pl-9" />
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">End Time</label>
                            <div className="relative">
                                <Input type="time" {...form.register("endTime")} className="bg-white/5 border-white/10 pl-9" />
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Grace Period (Min)</label>
                            <Input type="number" {...form.register("graceMinutes")} className="bg-white/5 border-white/10" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Break Duration (Min)</label>
                            <Input type="number" {...form.register("breakDuration")} className="bg-white/5 border-white/10" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Full Day Hours</label>
                            <Input type="number" {...form.register("fullDayHours")} className="bg-white/5 border-white/10" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Half Day Hours</label>
                            <Input type="number" {...form.register("halfDayHours")} className="bg-white/5 border-white/10" />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id="isDefault"
                            checked={form.watch("isDefault")}
                            onCheckedChange={(c) => form.setValue("isDefault", c as boolean)}
                            className="border-white/20 data-[state=checked]:bg-blue-600"
                        />
                        <label
                            htmlFor="isDefault"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Set as Default Shift
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {initialData ? "Update Shift" : "Create Shift"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
