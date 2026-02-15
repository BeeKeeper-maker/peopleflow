"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Edit, Trash, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteConfirmationModal } from "@/components/modals/delete-confirmation-modal"
import { useToast } from "@/components/ui/toast"
import { Employee } from "@/types/employee"

interface EmployeeActionsProps {
    employee: Employee
}

export function EmployeeActions({ employee }: EmployeeActionsProps) {
    const router = useRouter()
    const { addToast } = useToast()
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const response = await fetch(`/api/employees/${employee.id}`, {
                method: "DELETE",
            })

            if (!response.ok) {
                throw new Error("Failed to delete employee")
            }

            addToast({
                title: "Success",
                description: "Employee deleted successfully",
                type: "success",
            })

            router.refresh()
        } catch (error) {
            addToast({
                title: "Error",
                description: "Something went wrong",
                type: "error",
            })
        } finally {
            setIsDeleting(false)
            setShowDeleteModal(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => router.push(`/employees/${employee.id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Data
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/employees/${employee.id}/edit`)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowDeleteModal(true)} className="text-red-400 focus:text-red-400">
                        <Trash className="mr-2 h-4 w-4" />
                        Delete Employee
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DeleteConfirmationModal
                open={showDeleteModal}
                onOpenChange={(open) => setShowDeleteModal(open)}
                onConfirm={handleDelete}
                isLoading={isDeleting}
                title={`Delete ${employee.firstName} ${employee.lastName}?`}
                description="This will mark the employee as terminated and remove them from the active list."
            />
        </>
    )
}
