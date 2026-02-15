"use client"

import { useTranslations } from "next-intl"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DeleteConfirmationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    title?: string
    description?: string
    isLoading?: boolean
}

export function DeleteConfirmationModal({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    isLoading,
}: DeleteConfirmationModalProps) {
    const t = useTranslations("SharedComponents.deleteModal")
    const tc = useTranslations("SharedComponents.common")

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="bg-background border-card-border">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">
                        {title || t("defaultTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                        {description || t("defaultDescription")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="bg-hover border-card-border text-foreground hover:bg-hover hover:text-foreground">
                        {tc("cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="bg-red-600 text-foreground hover:bg-red-700"
                    >
                        {isLoading ? tc("deleting") : tc("delete")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
