"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { LeaveTypeForm } from "@/components/leaves/types/leave-type-form"
import { useTranslations } from "next-intl"

export default function NewLeaveTypePage() {
    const t = useTranslations("FormLeaveTypes")

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/leaves/types">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-foreground hover:text-foreground hover:bg-hover" title="Back" aria-label="Back">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t("createTitle")}</h1>
                    <p className="text-muted-foreground">{t("createSubtitle")}</p>
                </div>
            </div>

            <div className="rounded-xl border border-card-border bg-hover p-6">
                <LeaveTypeForm />
            </div>
        </div>
    )
}
