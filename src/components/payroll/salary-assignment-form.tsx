"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Loader2, Calculator, IndianRupee } from "lucide-react"
import { useToast } from "@/components/ui/toast"

const formSchema = z.object({
    employeeId: z.string().min(1, "Employee is required"),
    salaryStructureId: z.string().min(1, "Salary structure is required"),
    grossSalary: z.coerce.number().min(1000, "Minimum salary is 1000"),
    effectiveFrom: z.string().min(1, "Effective date is required"),
})

interface SalaryAssignmentFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

interface Employee {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
}

interface SalaryStructure {
    id: string
    name: string
    code: string
    basicPercentage: number
    houseRentPercent: number
    medicalPercent: number
    conveyanceFixed: number
    pfEmployeePercent: number
}

export function SalaryAssignmentForm({ open, onOpenChange, onSuccess }: SalaryAssignmentFormProps) {
    const { addToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [structures, setStructures] = useState<SalaryStructure[]>([])
    const [breakdown, setBreakdown] = useState<any>(null)

    const form = useForm<z.infer<typeof formSchema>>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            employeeId: "",
            salaryStructureId: "",
            grossSalary: 0,
            effectiveFrom: new Date().toISOString().split("T")[0],
        },
    })

    const watchGross = form.watch("grossSalary")
    const watchStructure = form.watch("salaryStructureId")

    // Fetch employees and structures
    useEffect(() => {
        if (open) {
            fetch("/api/employees?status=active")
                .then((res) => res.json())
                .then((data) => setEmployees(data.employees || []))
                .catch(console.error)

            fetch("/api/payroll/structures")
                .then((res) => res.json())
                .then((data) => setStructures(data || []))
                .catch(console.error)
        }
    }, [open])

    // Calculate breakdown when gross or structure changes
    useEffect(() => {
        if (watchGross && watchStructure) {
            const structure = structures.find((s) => s.id === watchStructure)
            if (structure) {
                const basic = (watchGross * structure.basicPercentage) / 100
                const houseRent = (basic * structure.houseRentPercent) / 100
                const medical = (basic * structure.medicalPercent) / 100
                const conveyance = structure.conveyanceFixed
                const pfEmployee = (basic * structure.pfEmployeePercent) / 100

                setBreakdown({
                    basic: Math.round(basic),
                    houseRent: Math.round(houseRent),
                    medical: Math.round(medical),
                    conveyance: Math.round(conveyance),
                    totalEarnings: Math.round(basic + houseRent + medical + conveyance),
                    pfEmployee: Math.round(pfEmployee),
                    netSalary: Math.round(watchGross - pfEmployee),
                })
            }
        } else {
            setBreakdown(null)
        }
    }, [watchGross, watchStructure, structures])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            setLoading(true)
            const res = await fetch("/api/payroll/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!res.ok) {
                const error = await res.text()
                throw new Error(error || "Failed to assign salary")
            }

            addToast({
                title: "Success",
                description: "Salary assigned successfully",
                type: "success",
            })

            form.reset()
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            addToast({
                title: "Error",
                description: error instanceof Error ? error.message : "Something went wrong",
                type: "error",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl bg-[#0F0F14] border-white/10 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-white flex items-center gap-2">
                        <IndianRupee className="h-5 w-5 text-emerald-400" />
                        Assign Salary
                    </SheetTitle>
                    <SheetDescription className="text-white/60">
                        Assign a salary structure to an employee
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
                        {/* Employee Selection */}
                        <FormField
                            control={form.control}
                            name="employeeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-white">Employee *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                <SelectValue placeholder="Select employee" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {employees.map((emp) => (
                                                <SelectItem key={emp.id} value={emp.id}>
                                                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Salary Structure Selection */}
                        <FormField
                            control={form.control}
                            name="salaryStructureId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-white">Salary Structure *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                <SelectValue placeholder="Select structure" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {structures.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.name} ({s.code || "N/A"})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Gross Salary */}
                        <FormField
                            control={form.control}
                            name="grossSalary"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-white">Gross Salary (BDT) *</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            placeholder="Enter gross salary"
                                            className="bg-white/5 border-white/10 text-white"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Effective Date */}
                        <FormField
                            control={form.control}
                            name="effectiveFrom"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-white">Effective From *</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            className="bg-white/5 border-white/10 text-white"
                                        />
                                    </FormControl>
                                    <FormDescription className="text-white/40">
                                        Previous assignment will be deactivated automatically
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Salary Breakdown Preview */}
                        {breakdown && (
                            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
                                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                                    <Calculator className="h-4 w-4" />
                                    Salary Breakdown Preview
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="space-y-2">
                                        <p className="text-white/60">Earnings</p>
                                        <div className="space-y-1 text-white/80">
                                            <div className="flex justify-between">
                                                <span>Basic</span>
                                                <span>৳{breakdown.basic.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>House Rent</span>
                                                <span>৳{breakdown.houseRent.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Medical</span>
                                                <span>৳{breakdown.medical.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Conveyance</span>
                                                <span>৳{breakdown.conveyance.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-white/60">Deductions</p>
                                        <div className="space-y-1 text-white/80">
                                            <div className="flex justify-between">
                                                <span>PF (Employee)</span>
                                                <span className="text-red-400">-৳{breakdown.pfEmployee.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-white/10 flex justify-between items-center text-white font-semibold">
                                    <span>Net Salary</span>
                                    <span className="text-xl text-emerald-400">৳{breakdown.netSalary.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="border-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Assign Salary
                            </Button>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
