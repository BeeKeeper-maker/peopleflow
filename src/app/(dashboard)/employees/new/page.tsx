"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { EmployeeForm } from "@/components/employees/employee-form"
import { useTranslations } from "next-intl"

export default function NewEmployeePage() {
    const t = useTranslations("FormEmployees")
    const tShared = useTranslations("SharedComponents")

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/employees">
                    <Button variant="ghost" size="icon" className="h-10 w-10" title={tShared("back")} aria-label={tShared("back")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t("createTitle")}</h1>
                    <p className="text-muted-foreground">{t("createSubtitle")}</p>
                </div>
            </div>

            <EmployeeForm />
        </div>
    )
}
