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
import { useTranslations } from "next-intl"

export default function SalaryStructuresPage() {
    const { addToast } = useToast()
    const t = useTranslations("PayrollStructures")
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
                const response = await res.json()
                setStructures(response.data || response || [])
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
            addToast({ title: t("deleteSuccess"), type: "success" })
            fetchStructures()
            setIsDeleteOpen(false)
        } catch (error) {
            addToast({
                title: t("deleteFailed"),
                description: error instanceof Error ? error.message : t("unknownError"),
                type: "error"
            })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
                </div>
                <Button onClick={() => { setSelectedStructure(null); setIsCreateOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-foreground">
                    <Plus className="mr-2 h-4 w-4" /> {t("addStructure")}
                </Button>
            </div>

            <Card className="bg-hover border-card-border text-foreground">
                <CardHeader>
                    <CardTitle>{t("activeStructures")}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        {t("manageDescription")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader className="bg-hover">
                            <TableRow className="border-card-border hover:bg-hover">
                                <TableHead className="text-muted-foreground">{t("nameCol")}</TableHead>
                                <TableHead className="text-muted-foreground text-center">{t("basicCol")}</TableHead>
                                <TableHead className="text-muted-foreground text-center">{t("houseRentCol")}</TableHead>
                                <TableHead className="text-muted-foreground text-center">{t("medicalCol")}</TableHead>
                                <TableHead className="text-muted-foreground text-center">{t("pfCol")}</TableHead>
                                <TableHead className="text-right text-muted-foreground">{t("actionsCol")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24 text-tertiary-foreground">{t("loading")}</TableCell></TableRow>
                            ) : structures.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24 text-tertiary-foreground">{t("noStructures")}</TableCell></TableRow>
                            ) : (
                                structures.map((structure) => (
                                    <TableRow key={structure.id} className="border-card-border hover:bg-hover">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded bg-blue-500/10 text-blue-400">
                                                    <Sliders className="h-4 w-4" />
                                                </div>
                                                {structure.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-foreground">{structure.basicPercentage}%</TableCell>
                                        <TableCell className="text-center text-foreground">{structure.houseRentPercent}%</TableCell>
                                        <TableCell className="text-center text-foreground">{structure.medicalPercent}%</TableCell>
                                        <TableCell className="text-center text-foreground">{structure.pfEmployeePercent}%</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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
                        open={isDeleteOpen}
                        onOpenChange={(open) => setIsDeleteOpen(open)}
                        onConfirm={handleDelete}
                        title={t("deleteTitle", { name: selectedStructure.name })}
                        description={t("deleteDescription")}
                    />
                </>
            )}
        </div>
    )
}
