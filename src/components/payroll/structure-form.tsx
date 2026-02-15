"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Form,
    FormControl,
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
import { Loader2, DollarSign } from "lucide-react"
import { useToast } from "@/components/ui/toast"

const formSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    code: z.string().optional(),
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
    onSuccess: () => void
    initialData?: {
        id: string
        name: string
        code: string | null
        basicPercentage: number
        houseRentPercent: number
        medicalPercent: number
        conveyanceFixed: number
        pfEmployeePercent: number
        pfEmployerPercent: number
        description: string | null
    }
}

export function StructureForm({ open, onOpenChange, onSuccess, initialData }: StructureFormProps) {
    const { addToast } = useToast()
    const [loading, setLoading] = useState(false)
    const t = useTranslations("SharedComponents.structureForm")
    const tc = useTranslations("SharedComponents.common")

    const form = useForm<z.infer<typeof formSchema>>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            code: initialData?.code || "",
            basicPercentage: initialData?.basicPercentage || 50,
            houseRentPercent: initialData?.houseRentPercent || 25,
            medicalPercent: initialData?.medicalPercent || 10,
            conveyanceFixed: initialData?.conveyanceFixed || 2500,
            pfEmployeePercent: initialData?.pfEmployeePercent || 0,
            pfEmployerPercent: initialData?.pfEmployerPercent || 0,
            description: initialData?.description || "",
        },
    })

    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name,
                code: initialData.code || "",
                basicPercentage: initialData.basicPercentage,
                houseRentPercent: initialData.houseRentPercent,
                medicalPercent: initialData.medicalPercent,
                conveyanceFixed: initialData.conveyanceFixed,
                pfEmployeePercent: initialData.pfEmployeePercent,
                pfEmployerPercent: initialData.pfEmployerPercent,
                description: initialData.description || "",
            })
        }
    }, [initialData, form])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            setLoading(true)
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
                const error = await res.text()
                throw new Error(error || tc("somethingWentWrong"))
            }

            addToast({
                title: tc("success"),
                description: initialData ? t("structureUpdated") : t("structureCreated"),
                type: "success",
            })

            form.reset()
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            addToast({
                title: tc("error"),
                description: error instanceof Error ? error.message : tc("somethingWentWrong"),
                type: "error",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl bg-background border-card-border overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-foreground flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-blue-400" />
                        {initialData ? t("editTitle") : t("createTitle")}
                    </SheetTitle>
                    <SheetDescription className="text-muted-foreground">
                        {t("sheetDescription")}
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground">{t("structureName")}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t("structureNamePlaceholder")} {...field} className="bg-hover border-card-border text-foreground" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Earnings */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-foreground mb-4">{t("earningsConfig")}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="basicPercentage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-xs">{t("basicOfGross")}</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="bg-hover border-card-border text-foreground" />
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
                                            <FormLabel className="text-foreground text-xs">{t("conveyanceFixed")}</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="bg-hover border-card-border text-foreground" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="houseRentPercent"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-xs">{t("houseRentOfBasic")}</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="bg-hover border-card-border text-foreground" />
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
                                            <FormLabel className="text-foreground text-xs">{t("medicalOfBasic")}</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="bg-hover border-card-border text-foreground" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Deductions */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-foreground mb-4">{t("deductionsPF")}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="pfEmployeePercent"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-xs">{t("employeeContribution")}</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="bg-hover border-card-border text-foreground" />
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
                                            <FormLabel className="text-foreground text-xs">{t("employerContribution")}</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="bg-hover border-card-border text-foreground" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground">{t("description")}</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder={t("descriptionPlaceholder")}
                                            {...field}
                                            className="bg-hover border-card-border text-foreground min-h-[80px]"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="border-card-border"
                            >
                                {tc("cancel")}
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-foreground"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {loading ? tc("saving") : t("saveStructure")}
                            </Button>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
