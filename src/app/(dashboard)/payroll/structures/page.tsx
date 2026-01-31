"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, Sliders } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { DeleteConfirmationModal } from "@/components/modals/delete-confirmation-modal"
import { StructureForm } from "@/components/payroll/structure-form"

export default function SalaryStructuresPage() {
    const { addToast } = useToast()
    const [structures, setStructures] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [selectedStructure, setSelectedStructure] = useState<any>(null)

    const fetchStructures = async () => {
        try {
            const res = await fetch("/api/payroll/structures")
            if (res.ok) {
                setStructures(await res.json())
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStructures()
    }, [])

    const handleDelete = async () => {
        if (!selectedStructure) return;
        try {
            const res = await fetch(`/api/payroll/structures/${selectedStructure.id}`, {
                method: "DELETE"
            })
            if (!res.ok) {
                const msg = await res.text()
                throw new Error(msg)
            }
            addToast({ title: "Structure deleted", type: "success" })
            fetchStructures()
            setIsDeleteOpen(false)
        } catch (error) {
            addToast({
                title: "Delete failed",
                description: error instanceof Error ? error.message : "Unknown error",
                type: "error"
            })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Salary Structures</h1>
                    <p className="text-white/60 mt-1">Define salary components and breakdown rules.</p>
                </div>
                <Button onClick={() => { setSelectedStructure(null); setIsCreateOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Add Structure
                </Button>
            </div>

            <Card className="bg-white/5 border-white/10 text-white">
                <CardHeader>
                    <CardTitle>Active Structures</CardTitle>
                    <CardDescription className="text-white/60">
                        Manage your organization's salary templates.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader className="bg-white/5">
                            <TableRow className="border-white/10 hover:bg-white/5">
                                <TableHead className="text-white/60">Name</TableHead>
                                <TableHead className="text-white/60 text-center">Basic %</TableHead>
                                <TableHead className="text-white/60 text-center">House Rent %</TableHead>
                                <TableHead className="text-white/60 text-center">Medical %</TableHead>
                                <TableHead className="text-white/60 text-center">PF %</TableHead>
                                <TableHead className="text-right text-white/60">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24 text-white/50">Loading...</TableCell></TableRow>
                            ) : structures.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24 text-white/50">No structures found.</TableCell></TableRow>
                            ) : (
                                structures.map((structure) => (
                                    <TableRow key={structure.id} className="border-white/10 hover:bg-white/5">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded bg-blue-500/10 text-blue-400">
                                                    <Sliders className="h-4 w-4" />
                                                </div>
                                                {structure.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-white/80">{structure.basicPercentage}%</TableCell>
                                        <TableCell className="text-center text-white/80">{structure.houseRentPercent}%</TableCell>
                                        <TableCell className="text-center text-white/80">{structure.medicalPercent}%</TableCell>
                                        <TableCell className="text-center text-white/80">{structure.pfEmployeePercent}%</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-white/60 hover:text-white"
                                                    onClick={() => { setSelectedStructure(structure); setIsEditOpen(true); }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    onClick={() => { setSelectedStructure(structure); setIsDeleteOpen(true); }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <StructureForm
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={fetchStructures}
            />

            {selectedStructure && (
                <>
                    <StructureForm
                        open={isEditOpen}
                        onOpenChange={setIsEditOpen}
                        initialData={selectedStructure}
                        onSuccess={fetchStructures}
                    />
                    <DeleteConfirmationModal
                        isOpen={isDeleteOpen}
                        onClose={() => setIsDeleteOpen(false)}
                        onConfirm={handleDelete}
                        title={`Delete ${selectedStructure.name}?`}
                        description="This action will permanently delete the salary structure. This is only possible if no employees are assigned to it."
                    />
                </>
            )}
        </div>
    )
}
