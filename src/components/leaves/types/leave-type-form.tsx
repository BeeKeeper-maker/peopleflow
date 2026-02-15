"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"

const formSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    code: z.string().min(1, "Code is required"),
    color: z.string().default("#3b82f6"),
    annualAllocation: z.coerce.number().min(1, "Must be at least 1 day"),
    maxCarryForward: z.coerce.number().optional(),
    applicableGender: z.string().default("all"),
    isActive: z.boolean().default(true),
    isProRata: z.boolean().default(false),
    requireDocument: z.boolean().default(false),
})

interface LeaveTypeFormProps {
    initialData?: {
        id: string
        name: string
        code: string
        color: string
        annualAllocation: number
        maxCarryForward: number | null
        applicableGender: string
        isActive: boolean
        isProRata: boolean
        requireDocument: boolean
    }
}

export function LeaveTypeForm({ initialData }: LeaveTypeFormProps) {
    const router = useRouter()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const t = useTranslations("SharedComponents.leaveTypeForm")
    const tc = useTranslations("SharedComponents.common")

    const form = useForm<z.infer<typeof formSchema>>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            code: initialData?.code || "",
            color: initialData?.color || "#3b82f6",
            annualAllocation: initialData?.annualAllocation || 0,
            maxCarryForward: initialData?.maxCarryForward || undefined,
            applicableGender: initialData?.applicableGender || "all",
            isActive: initialData?.isActive ?? true,
            isProRata: initialData?.isProRata ?? false,
            requireDocument: initialData?.requireDocument ?? false,
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            setIsLoading(true)
            const url = initialData
                ? `/api/leaves/types/${initialData.id}`
                : "/api/leaves/types"
            const method = initialData ? "PUT" : "POST"

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(error || tc("somethingWentWrong"))
            }

            addToast({
                title: tc("success"),
                description: initialData
                    ? "Leave type updated successfully"
                    : "Leave type created successfully",
                type: "success",
            })

            router.push("/leaves/types")
            router.refresh()
        } catch (error) {
            addToast({
                title: tc("error"),
                description: error instanceof Error ? error.message : tc("somethingWentWrong"),
                type: "error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Basic Information */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-foreground">{t("basicInfo")}</h3>
                    <div className="grid gap-6 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground">{t("nameLabel")}</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            disabled={isLoading}
                                            className="bg-hover border-card-border text-foreground"
                                            placeholder={t("namePlaceholder")}
                                        />
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
                                    <FormLabel className="text-foreground">{t("codeLabel")}</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            disabled={isLoading}
                                            className="bg-hover border-card-border text-foreground"
                                            placeholder={t("codePlaceholder")}
                                        />
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
                                    <FormLabel className="text-foreground">{t("colorLabel")}</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-3">
                                            <Input
                                                type="color"
                                                {...field}
                                                disabled={isLoading}
                                                className="h-10 w-20 p-1 bg-hover border-card-border"
                                            />
                                            <Input
                                                value={field.value}
                                                onChange={field.onChange}
                                                disabled={isLoading}
                                                className="bg-hover border-card-border text-foreground"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground">{t("statusLabel")}</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(value === "true")}
                                        defaultValue={field.value ? "true" : "false"}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="bg-hover border-card-border text-foreground">
                                                <SelectValue placeholder={tc("selectStatus")} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="true">{tc("active")}</SelectItem>
                                            <SelectItem value="false">{tc("inactive")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* Allocation Rules */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-foreground">{t("allocationRules")}</h3>
                    <div className="grid gap-6 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="annualAllocation"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground">{t("annualDays")}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            disabled={isLoading}
                                            className="bg-hover border-card-border text-foreground"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="maxCarryForward"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground">{t("maxCarryForward")}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            disabled={isLoading}
                                            className="bg-hover border-card-border text-foreground"
                                        />
                                    </FormControl>
                                    <FormDescription className="text-tertiary-foreground">
                                        {t("carryForwardDesc")}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="applicableGender"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-foreground">{t("applicableFor")}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-hover border-card-border text-foreground">
                                                <SelectValue placeholder={t("selectGender")} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="all">{t("allEmployees")}</SelectItem>
                                            <SelectItem value="male">{t("maleOnly")}</SelectItem>
                                            <SelectItem value="female">{t("femaleOnly")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* Configuration */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-foreground">{t("configuration")}</h3>
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="isProRata"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border border-card-border p-4">
                                    <div>
                                        <FormLabel className="text-foreground">{t("proRataBasis")}</FormLabel>
                                        <FormDescription className="text-tertiary-foreground">
                                            {t("proRataDesc")}
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="requireDocument"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border border-card-border p-4">
                                    <div>
                                        <FormLabel className="text-foreground">{t("requireDocuments")}</FormLabel>
                                        <FormDescription className="text-tertiary-foreground">
                                            {t("requireDocumentsDesc")}
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push("/leaves/types")}
                        className="border-card-border"
                    >
                        {tc("cancel")}
                    </Button>
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-foreground"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? tc("save") : t("saveLeaveType")}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
