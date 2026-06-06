"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { BadgeCheck, Ban, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface LeaveRequestActionsProps {
    id: string
    status: string
    onCompleted?: () => void
}

export function LeaveRequestActions({ id, status, onCompleted }: LeaveRequestActionsProps) {
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [action, setAction] = useState<"approved" | "rejected" | null>(null)
    const [comment, setComment] = useState("")
    const [isOpen, setIsOpen] = useState(false)
    const t = useTranslations("SharedComponents.leaveRequestActions")
    const tc = useTranslations("SharedComponents.common")

    const isPending = status.toLowerCase() === "pending"

    async function onAction() {
        if (!action) return
        if (action === "rejected" && !comment.trim()) {
            addToast({
                title: t("rejectionNoteRequired"),
                type: "error",
            })
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch(`/api/leaves/applications/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: action,
                    managerComment: comment.trim(),
                }),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(error)
            }

            addToast({
                title: action === "approved" ? t("applicationApproved") : t("applicationRejected"),
                type: action === "approved" ? "success" : "info",
            })

            setIsOpen(false)
            onCompleted?.()
            window.dispatchEvent(new CustomEvent("leave-request-updated"))
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

    const openDialog = (type: "approved" | "rejected") => {
        setAction(type)
        setComment("")
        setIsOpen(true)
    }

    if (!isPending) {
        return <span className="text-xs text-muted-foreground">{t("noActionNeeded")}</span>
    }

    return (
        <div className="flex items-center gap-2">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-foreground gap-1 h-8"
                    onClick={() => openDialog("approved")}
                >
                    <BadgeCheck className="h-4 w-4" />
                    {t("approve")}
                </Button>

                <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1 h-8"
                    onClick={() => openDialog("rejected")}
                >
                    <Ban className="h-4 w-4" />
                    {t("reject")}
                </Button>

                <DialogContent className="sm:max-w-[460px] bg-muted border-card-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>
                            {action === "approved" ? t("approveTitle") : t("rejectTitle")}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {action === "approved"
                                ? t("approveDescription")
                                : t("rejectDescription")
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                        <Textarea
                            placeholder={action === "approved" ? t("approveComment") : t("rejectComment")}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="bg-hover border-card-border text-foreground min-h-[110px]"
                        />
                        {action === "rejected" && (
                            <p className="text-xs text-amber-400">{t("rejectCommentRequiredHint")}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setIsOpen(false)}
                            className="text-foreground hover:text-foreground hover:bg-hover"
                        >
                            {tc("cancel")}
                        </Button>
                        <Button
                            onClick={onAction}
                            disabled={isLoading || (action === "rejected" && !comment.trim())}
                            className={cn(
                                "text-foreground",
                                action === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                            )}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {action === "approved" ? t("confirmApproval") : t("confirmRejection")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
