"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"

const formSchema = z.object({
    name: z.string().min(2, "Department name must be at least 2 characters"),
    code: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
})

interface DepartmentFormProps {
    initialData?: {
        id: string
        name: string
        code: string | null
        description: string | null
        isActive: boolean
    }
}

export function DepartmentForm({ initialData }: DepartmentFormProps) {
    const router = useRouter()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const t = useTranslations("SharedComponents.departmentForm")
    const tc = useTranslations("SharedComponents.common")

    const form = useForm<z.infer<typeof formSchema>>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            code: initialData?.code || "",
            description: initialData?.description || "",
            isActive: initialData?.isActive ?? true,
        },
    })

    const submitLabel = initialData ? tc("save") : t("saveDepartment")

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            setIsLoading(true)
            const url = initialData
                ? `/api/departments/${initialData.id}`
                : "/api/departments"
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
                    ? "Department updated successfully"
                    : "Department created successfully",
                type: "success",
            })

            router.push("/departments")
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">{t("descriptionLabel")}</FormLabel>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    disabled={isLoading}
                                    className="bg-hover border-card-border text-foreground min-h-[100px]"
                                    placeholder={t("descriptionPlaceholder")}
                                />
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

                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push("/departments")}
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
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
