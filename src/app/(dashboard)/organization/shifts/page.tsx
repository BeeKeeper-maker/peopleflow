"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ShiftForm } from "@/components/organization/shifts/shift-form"
import { useToast } from "@/components/ui/toast"
import { DeleteConfirmationModal } from "@/components/modals/delete-confirmation-modal"

export default function ShiftsPage() {
    const { addToast } = useToast()
    const [shifts, setShifts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [selectedShift, setSelectedShift] = useState<any>(null)

    const fetchShifts = async () => {
        try {
            const res = await fetch("/api/shifts")
            if (res.ok) {
                setShifts(await res.json())
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchShifts()
    }, [])

    const handleDelete = async () => {
        if (!selectedShift) return;
        try {
            const res = await fetch(`/api/shifts/${selectedShift.id}`, {
                method: "DELETE"
            })
            if (!res.ok) {
                const msg = await res.text()
                throw new Error(msg)
            }
            addToast({ title: "Shift deleted", type: "success" })
            fetchShifts()
            setIsDeleteOpen(false)
        } catch (error) {
            addToast({ title: "Delete failed", description: error instanceof Error ? error.message : "Unknown error", type: "error" })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Shift Management</h1>
                    <p className="text-white/60 mt-1">Configure working hours and shift rules</p>
                </div>
                <Button onClick={() => { setSelectedShift(null); setIsCreateOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Add Shift
                </Button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="text-white/60">Shift Name</TableHead>
                            <TableHead className="text-white/60">Timing</TableHead>
                            <TableHead className="text-white/60">Grace Period</TableHead>
                            <TableHead className="text-white/60">Full Day</TableHead>
                            <TableHead className="text-white/60">Default</TableHead>
                            <TableHead className="text-right text-white/60">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center h-24 text-white/50">Loading...</TableCell></TableRow>
                        ) : shifts.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center h-24 text-white/50">No shifts found. Create one to get started.</TableCell></TableRow>
                        ) : (
                            shifts.map((shift) => (
                                <TableRow key={shift.id} className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-white">{shift.name}</TableCell>
                                    <TableCell className="text-white/80">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="border-blue-500/30 text-blue-400 bg-blue-500/10">
                                                {shift.startTime}
                                            </Badge>
                                            <span className="text-white/40">to</span>
                                            <Badge variant="secondary" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
                                                {shift.endTime}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-white/80">{shift.graceMinutes} min</TableCell>
                                    <TableCell className="text-white/80">{shift.fullDayHours} hrs</TableCell>
                                    <TableCell>
                                        {shift.isDefault && (
                                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                                <CheckCircle2 className="mr-1 h-3 w-3" /> Default
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-white/60 hover:text-white"
                                                onClick={() => { setSelectedShift(shift); setIsEditOpen(true); }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                onClick={() => { setSelectedShift(shift); setIsDeleteOpen(true); }}
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
            </div>

            <ShiftForm
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={fetchShifts}
            />

            {selectedShift && (
                <>
                    <ShiftForm
                        open={isEditOpen}
                        onOpenChange={setIsEditOpen}
                        initialData={selectedShift}
                        onSuccess={fetchShifts}
                    />
                    <DeleteConfirmationModal
                        isOpen={isDeleteOpen}
                        onClose={() => setIsDeleteOpen(false)}
                        onConfirm={handleDelete}
                        title={`Delete ${selectedShift.name}?`}
                        description="This action will delete the shift permanently. You cannot delete a shift if it is actively assigned to employees."
                    />
                </>
            )}
        </div>
    )
}
