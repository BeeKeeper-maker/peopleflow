"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Trash } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteConfirmationModal } from "@/components/modals/delete-confirmation-modal"
import { useToast } from "@/components/ui/toast"

interface DepartmentActionsProps {
    id: string
}

export function DepartmentActions({ id }: DepartmentActionsProps) {
    const router = useRouter()
    const { addToast } = useToast()
    const [showDeleteAlert, setShowDeleteAlert] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const t = useTranslations("SharedComponents.departmentActions")
    const tc = useTranslations("SharedComponents.common")

    async function onDelete() {
        try {
            setIsDeleting(true)
            const response = await fetch(`/api/departments/${id}`, {
                method: "DELETE",
            })

            if (!response.ok) {
                throw new Error("Failed to delete department")
            }

            addToast({
                title: tc("success"),
                description: t("deleteSuccess"),
                type: "success",
            })

            router.refresh()
        } catch (error) {
            addToast({
                title: tc("error"),
                description: error instanceof Error ? error.message : tc("somethingWentWrong"),
                type: "error",
            })
        } finally {
            setIsDeleting(false)
            setShowDeleteAlert(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">{tc("openMenu")}</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background border-card-border">
                    <DropdownMenuItem onClick={() => router.push(`/departments/${id}/edit`)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {tc("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setShowDeleteAlert(true)}
                        className="text-red-600 focus:text-red-600"
                    >
                        <Trash className="mr-2 h-4 w-4" />
                        {tc("delete")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DeleteConfirmationModal
                open={showDeleteAlert}
                onOpenChange={setShowDeleteAlert}
                onConfirm={onDelete}
                title={t("deleteTitle")}
                description={t("deleteDescription")}
                isLoading={isDeleting}
            />
        </>
    )
}
