"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, Ban, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface LeaveRequestActionsProps {
    id: string
}

export function LeaveRequestActions({ id }: LeaveRequestActionsProps) {
    const router = useRouter()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [action, setAction] = useState<"approved" | "rejected" | null>(null)
    const [comment, setComment] = useState("")
    const [isOpen, setIsOpen] = useState(false)

    async function onAction() {
        if (!action) return

        setIsLoading(true)
        try {
            const response = await fetch(`/api/leaves/applications/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: action,
                    managerComment: comment,
                }),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(error)
            }

            addToast({
                title: action === "approved" ? "Application Approved" : "Application Rejected",
                type: action === "approved" ? "success" : "info",
            })

            setIsOpen(false)
            router.refresh()
        } catch (error) {
            addToast({
                title: "Error",
                description: error instanceof Error ? error.message : "Something went wrong",
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

    return (
        <div className="flex items-center gap-2">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white gap-1 h-8"
                    onClick={() => openDialog("approved")}
                >
                    <BadgeCheck className="h-4 w-4" />
                    Approve
                </Button>

                <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1 h-8"
                    onClick={() => openDialog("rejected")}
                >
                    <Ban className="h-4 w-4" />
                    Reject
                </Button>

                <DialogContent className="sm:max-w-[425px] bg-[#1C1C24] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>
                            {action === "approved" ? "Approve Leave Request" : "Reject Leave Request"}
                        </DialogTitle>
                        <DialogDescription className="text-white/60">
                            {action === "approved"
                                ? "Are you sure you want to approve this leave request? Leave balance will be deducted."
                                : "Are you sure you want to reject this leave request? Please provide a reason."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea
                            placeholder={action === "approved" ? "Add an optional comment..." : "Reason for rejection..."}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="bg-white/5 border-white/10 text-white min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setIsOpen(false)}
                            className="text-white hover:text-white hover:bg-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onAction}
                            disabled={isLoading}
                            className={cn(
                                "text-white",
                                action === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                            )}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm {action === "approved" ? "Approval" : "Rejection"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
