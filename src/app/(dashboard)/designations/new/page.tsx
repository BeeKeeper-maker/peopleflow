"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { DesignationForm } from "@/components/designations/designation-form"
import { useTranslations } from "next-intl"

export default function NewDesignationPage() {
    const t = useTranslations("FormDesignations")

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/designations">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-foreground hover:text-foreground hover:bg-hover">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t("createTitle")}</h1>
                    <p className="text-muted-foreground">{t("createSubtitle")}</p>
                </div>
            </div>

            <div className="rounded-xl border border-card-border bg-hover p-6">
                <DesignationForm />
            </div>
        </div>
    )
}
