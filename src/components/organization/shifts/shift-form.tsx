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
import { Clock, Moon } from "lucide-react"

// Shift form schema — now includes all schema fields:
//   - code (required for @@unique([organizationId, code]))
//   - nameBn (Bengali name for display)
//   - crossesMidnight (night shift support, e.g. 22:00 → 06:00)
// Previously these fields were missing from the form, so night shifts
// could not be configured from the UI — a major blocker for RMG/factory
// clients that run 24-hour operations with cross-midnight shifts.
const shiftSchema = z.object({
    name: z.string().min(1, "Name is required"),
    nameBn: z.string().optional(),
    code: z.string().min(1, "Code is required").max(20, "Code must be 20 characters or less"),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time format HH:mm required"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time format HH:mm required"),
    breakDuration: z.coerce.number().min(0, "Must be positive"),
    graceMinutes: z.coerce.number().min(0, "Must be positive"),
    halfDayHours: z.coerce.number().min(0, "Must be positive"),
    fullDayHours: z.coerce.number().min(0, "Must be positive"),
    crossesMidnight: z.boolean().default(false),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
})

type ShiftFormValues = z.infer<typeof shiftSchema>

interface ShiftFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData?: any
    onSuccess: () => void
}

export function ShiftForm({ open, onOpenChange, initialData, onSuccess }: ShiftFormProps) {
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<ShiftFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(shiftSchema) as any,
        defaultValues: initialData
            ? {
                  name: initialData.name || "",
                  nameBn: initialData.nameBn || "",
                  code: initialData.code || "",
                  startTime: initialData.startTime || "09:00",
                  endTime: initialData.endTime || "18:00",
                  breakDuration: initialData.breakDuration ?? 60,
                  graceMinutes: initialData.graceMinutes ?? 15,
                  halfDayHours: initialData.halfDayHours ?? 4,
                  fullDayHours: initialData.fullDayHours ?? 8,
                  crossesMidnight: initialData.crossesMidnight ?? false,
                  isDefault: initialData.isDefault ?? false,
                  isActive: initialData.isActive ?? true,
              }
            : {
                  name: "",
                  nameBn: "",
                  code: "",
                  startTime: "09:00",
                  endTime: "18:00",
                  breakDuration: 60,
                  graceMinutes: 15,
                  halfDayHours: 4,
                  fullDayHours: 8,
                  crossesMidnight: false,
                  isDefault: false,
                  isActive: true,
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
                description: error instanceof Error ? error.message : "Something went wrong",
                type: "error"
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] bg-card border-card-border text-foreground">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Edit Shift" : "Create New Shift"}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Define working hours and rules for this shift. Enable &quot;Crosses Midnight&quot; for night shifts (e.g. 22:00 → 06:00).
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Shift Name (English)</label>
                            <Input {...form.register("name")} placeholder="e.g. General Shift" className="bg-hover border-card-border" />
                            {form.formState.errors.name && (
                                <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Shift Name (Bengali)</label>
                            <Input {...form.register("nameBn")} placeholder="যেমন সাধারণ শিফট" className="bg-hover border-card-border" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Shift Code</label>
                        <Input {...form.register("code")} placeholder="e.g. GS, NS, F1" className="bg-hover border-card-border" />
                        {form.formState.errors.code && (
                            <p className="text-xs text-red-500">{form.formState.errors.code.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Unique short code used in reports and exports.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Start Time</label>
                            <div className="relative">
                                <Input type="time" {...form.register("startTime")} className="bg-hover border-card-border pl-9" />
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-tertiary-foreground" />
                            </div>
                            {form.formState.errors.startTime && (
                                <p className="text-xs text-red-500">{form.formState.errors.startTime.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">End Time</label>
                            <div className="relative">
                                <Input type="time" {...form.register("endTime")} className="bg-hover border-card-border pl-9" />
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-tertiary-foreground" />
                            </div>
                            {form.formState.errors.endTime && (
                                <p className="text-xs text-red-500">{form.formState.errors.endTime.message}</p>
                            )}
                        </div>
                    </div>

                    {/* Night shift toggle — critical for RMG/factory clients */}
                    <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="crossesMidnight"
                                checked={form.watch("crossesMidnight")}
                                onCheckedChange={(c) => form.setValue("crossesMidnight", c as boolean)}
                                className="border-border-hover data-[state=checked]:bg-blue-600"
                            />
                            <label
                                htmlFor="crossesMidnight"
                                className="text-sm font-medium leading-none flex items-center gap-1.5"
                            >
                                <Moon className="h-3.5 w-3.5" />
                                Crosses Midnight (Night Shift)
                            </label>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 ml-6">
                            Enable for shifts that end on the next calendar day (e.g. 22:00 → 06:00).
                            Attendance will be anchored to the date the shift STARTED.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Grace Period (Min)</label>
                            <Input type="number" {...form.register("graceMinutes")} className="bg-hover border-card-border" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Break Duration (Min)</label>
                            <Input type="number" {...form.register("breakDuration")} className="bg-hover border-card-border" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Full Day Hours</label>
                            <Input type="number" {...form.register("fullDayHours")} className="bg-hover border-card-border" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Half Day Hours</label>
                            <Input type="number" {...form.register("halfDayHours")} className="bg-hover border-card-border" />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id="isDefault"
                            checked={form.watch("isDefault")}
                            onCheckedChange={(c) => form.setValue("isDefault", c as boolean)}
                            className="border-border-hover data-[state=checked]:bg-blue-600"
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
                        <Button type="submit" isLoading={isLoading} className="bg-blue-600 hover:bg-blue-700 text-foreground">
                            {initialData ? "Update Shift" : "Create Shift"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
