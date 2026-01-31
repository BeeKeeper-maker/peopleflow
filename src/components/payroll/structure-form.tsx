"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/components/ui/toast"
import { Card, CardContent } from "@/components/ui/card"

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    basicPercentage: z.coerce.number().min(0).max(100),
    houseRentPercent: z.coerce.number().min(0).max(100),
    medicalPercent: z.coerce.number().min(0).max(100),
    conveyanceFixed: z.coerce.number().min(0),
    pfEmployeePercent: z.coerce.number().min(0).max(100),
    pfEmployerPercent: z.coerce.number().min(0).max(100),
    description: z.string().optional(),
})

interface StructureFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: any
    onSuccess: () => void
}

export function StructureForm({ open, onOpenChange, initialData, onSuccess }: StructureFormProps) {
    const { addToast } = useToast()
    const [loading, setLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            basicPercentage: initialData?.basicPercentage || 50,
            houseRentPercent: initialData?.houseRentPercent || 50,
            medicalPercent: initialData?.medicalPercent || 10,
            conveyanceFixed: initialData?.conveyanceFixed || 3000,
            pfEmployeePercent: initialData?.pfEmployeePercent || 10,
            pfEmployerPercent: initialData?.pfEmployerPercent || 10,
            description: initialData?.description || "",
        },
    })

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const url = initialData
                ? `/api/payroll/structures/${initialData.id}`
                : "/api/payroll/structures"
            const method = initialData ? "PUT" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!res.ok) {
                throw new Error(await res.text())
            }

            addToast({
                title: initialData ? "Structure updated" : "Structure created",
                type: "success",
            })
            onSuccess()
            onOpenChange(false)
            form.reset()
        } catch (error) {
            addToast({
                title: "Error",
                description: error instanceof Error ? error.message : "Something went wrong",
                type: "error",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] border-l border-white/10 bg-[#0A0A0F] text-white p-0">
                <div className="h-full flex flex-col p-6">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-xl font-bold text-white">
                            {initialData ? "Edit Salary Structure" : "Create Salary Structure"}
                        </SheetTitle>
                        <SheetDescription className="text-white/60">
                            Configure salary components and their percentages.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-white">Structure Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. Executive Grade A"
                                                    {...field}
                                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Card className="bg-white/5 border-white/10 p-4">
                                    <h3 className="text-sm font-semibold text-white mb-4">Earnings Configuration</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="basicPercentage"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-white/80 text-xs">Basic (% of Gross)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} className="bg-black/20 border-white/10 text-white" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="conveyanceFixed"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-white/80 text-xs">Conveyance (Fixed Amount)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} className="bg-black/20 border-white/10 text-white" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="houseRentPercent"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-white/80 text-xs">House Rent (% of Basic)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} className="bg-black/20 border-white/10 text-white" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="medicalPercent"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-white/80 text-xs">Medical (% of Basic)</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} className="bg-black/20 border-white/10 text-white" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </Card>

                                <Card className="bg-white/5 border-white/10 p-4">
                                    <h3 className="text-sm font-semibold text-white mb-4">Deductions (PF)</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="pfEmployeePercent"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-white/80 text-xs">Employee Contribution (%)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} className="bg-black/20 border-white/10 text-white" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="pfEmployerPercent"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-white/80 text-xs">Employer Contribution (%)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} className="bg-black/20 border-white/10 text-white" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </Card>

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-white">Description</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Additional notes..."
                                                    {...field}
                                                    className="bg-white/5 border-white/10 text-white resize-none"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} className="text-white/60 hover:text-white">
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                                        {loading ? "Saving..." : "Save Structure"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
