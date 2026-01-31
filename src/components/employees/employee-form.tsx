"use client"

import { useState, useEffect, useRef } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectField } from "@/components/ui/select-field"
import { employeeSchema, EmployeeFormValues, EmployeeFormInput } from "@/lib/validations/employee"
import { Save, Upload } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/toast"

interface EmployeeFormProps {
    initialData?: EmployeeFormInput
    onSubmit: (data: EmployeeFormValues) => Promise<void>
    isLoading: boolean
    submitLabel?: string
}

export function EmployeeForm({ initialData, onSubmit, isLoading, submitLabel = "Create Employee" }: EmployeeFormProps) {
    const { addToast } = useToast()
    const [departments, setDepartments] = useState<{ label: string; value: string }[]>([])
    const [designations, setDesignations] = useState<{ label: string; value: string }[]>([])
    const [shifts, setShifts] = useState<{ label: string; value: string }[]>([])
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const form = useForm<EmployeeFormInput, unknown, EmployeeFormValues>({
        resolver: zodResolver(employeeSchema),
        defaultValues: initialData || {
            employmentStatus: "active",
            employmentType: "permanent",
            gender: "male",
            maritalStatus: "single",
            nationality: "Bangladeshi",
            pfEnabled: true,
        },
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [deptRes, desigRes, shiftRes] = await Promise.all([
                    fetch("/api/departments"),
                    fetch("/api/designations"),
                    fetch("/api/shifts")
                ])

                if (deptRes.ok) {
                    const data = await deptRes.json()
                    setDepartments(data.map((d: { name: string; id: string }) => ({ label: d.name, value: d.id })))
                }

                if (desigRes.ok) {
                    const data = await desigRes.json()
                    setDesignations(data.map((d: { name: string; id: string }) => ({ label: d.name, value: d.id })))
                }

                if (shiftRes.ok) {
                    const data = await shiftRes.json()
                    setShifts(data.map((d: { name: string; id: string; startTime: string; endTime: string }) => ({
                        label: `${d.name} (${d.startTime} - ${d.endTime})`,
                        value: d.id
                    })))
                }
            } catch (error) {
                console.error("Failed to fetch form data", error)
            }
        }

        fetchData()
    }, [])

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            alert("File size must be less than 5MB")
            return
        }

        setUploading(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) throw new Error("Upload failed")

            const data = await res.json()
            console.log("Photo uploaded:", data.url)
            form.setValue("photoUrl", data.url)

            addToast({
                title: "Photo Uploaded",
                description: "Profile photo updated successfully",
                type: "success"
            })
        } catch (error) {
            console.error(error)
            addToast({
                title: "Upload Failed",
                description: "Could not upload profile photo",
                type: "error"
            })
        } finally {
            setUploading(false)
        }
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Information */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-white mb-4">Personal Information</h2>

                {/* Photo Upload Area */}
                <div className="mb-6 flex items-center gap-6">
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white/10 bg-white/5">
                        {form.watch("photoUrl") ? (
                            <img src={form.watch("photoUrl") ?? ""} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/20">
                                <Upload className="h-8 w-8" />
                            </div>
                        )}
                    </div>
                    <div>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                isLoading={uploading}
                            >
                                {uploading ? "Uploading..." : "Upload Photo"}
                            </Button>
                            {form.watch("photoUrl") && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-red-400 hover:text-red-300"
                                    onClick={() => form.setValue("photoUrl", "")}
                                >
                                    Remove
                                </Button>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-white/40">
                            Recommended: Square image, max 5MB.
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Input
                        label="First Name"
                        {...form.register("firstName")}
                        error={form.formState.errors.firstName?.message}
                        required
                    />
                    <Input
                        label="Last Name"
                        {...form.register("lastName")}
                        error={form.formState.errors.lastName?.message}
                        required
                    />
                    <Input
                        label="Email"
                        type="email"
                        {...form.register("email")}
                        error={form.formState.errors.email?.message}
                        required
                    />
                    <Input
                        label="Phone"
                        {...form.register("phone")}
                        error={form.formState.errors.phone?.message}
                    />
                    <Input
                        label="Date of Birth"
                        type="date"
                        {...form.register("dateOfBirth")}
                        error={form.formState.errors.dateOfBirth?.message as string}
                    />
                    <Controller
                        name="gender"
                        control={form.control}
                        render={({ field }) => (
                            <SelectField
                                label="Gender"
                                value={field.value}
                                onValueChange={field.onChange}
                                error={form.formState.errors.gender?.message}
                                options={[
                                    { label: "Male", value: "male" },
                                    { label: "Female", value: "female" },
                                    { label: "Other", value: "other" },
                                ]}
                            />
                        )}
                    />
                    <Controller
                        name="maritalStatus"
                        control={form.control}
                        render={({ field }) => (
                            <SelectField
                                label="Marital Status"
                                value={field.value}
                                onValueChange={field.onChange}
                                error={form.formState.errors.maritalStatus?.message}
                                options={[
                                    { label: "Single", value: "single" },
                                    { label: "Married", value: "married" },
                                    { label: "Divorced", value: "divorced" },
                                    { label: "Widowed", value: "widowed" },
                                ]}
                            />
                        )}
                    />
                    <Input
                        label="Nationality"
                        {...form.register("nationality")}
                        error={form.formState.errors.nationality?.message}
                    />
                    <Input
                        label="National ID (NID)"
                        {...form.register("nidNumber")}
                        error={form.formState.errors.nidNumber?.message}
                    />
                </div>
            </div>

            {/* Employment Details */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-white mb-4">Employment Details</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Input
                        label="Employee Code"
                        {...form.register("employeeCode")}
                        error={form.formState.errors.employeeCode?.message}
                        required
                    />
                    <Controller
                        name="departmentId"
                        control={form.control}
                        render={({ field }) => (
                            <SelectField
                                label="Department"
                                value={field.value}
                                onValueChange={field.onChange}
                                error={form.formState.errors.departmentId?.message}
                                options={departments}
                                required
                                placeholder="Select Department"
                            />
                        )}
                    />
                    <Controller
                        name="designationId"
                        control={form.control}
                        render={({ field }) => (
                            <SelectField
                                label="Designation"
                                value={field.value}
                                onValueChange={field.onChange}
                                error={form.formState.errors.designationId?.message}
                                options={designations}
                                required
                                placeholder="Select Designation"
                            />
                        )}
                    />
                    <Input
                        label="Joining Date"
                        type="date"
                        {...form.register("joiningDate")}
                        error={form.formState.errors.joiningDate?.message as string}
                        required
                    />
                    <Controller
                        name="employmentType"
                        control={form.control}
                        render={({ field }) => (
                            <SelectField
                                label="Employment Type"
                                value={field.value}
                                onValueChange={field.onChange}
                                error={form.formState.errors.employmentType?.message}
                                options={[
                                    { label: "Permanent", value: "permanent" },
                                    { label: "Contractual", value: "contractual" },
                                    { label: "Intern", value: "intern" },
                                    { label: "Probation", value: "probation" },
                                ]}
                                required
                            />
                        )}
                    />
                    <Controller
                        name="employmentStatus"
                        control={form.control}
                        render={({ field }) => (
                            <SelectField
                                label="Status"
                                value={field.value}
                                onValueChange={field.onChange}
                                error={form.formState.errors.employmentStatus?.message}
                                options={[
                                    { label: "Active", value: "active" },
                                    { label: "Resigned", value: "resigned" },
                                    { label: "Terminated", value: "terminated" },
                                    { label: "Retired", value: "retired" },
                                ]}
                                required
                            />
                        )}
                    />
                    <Controller
                        name="shiftId"
                        control={form.control}
                        render={({ field }) => (
                            <SelectField
                                label="Shift"
                                value={field.value || ""}
                                onValueChange={field.onChange}
                                error={form.formState.errors.shiftId?.message}
                                options={shifts}
                                placeholder="Select Shift"
                            />
                        )}
                    />
                </div>
            </div>

            {/* Financial Information */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-white mb-4">Financial Information</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Input
                        label="Gross Salary"
                        type="number"
                        {...form.register("grossSalary")}
                        error={form.formState.errors.grossSalary?.message}
                        required
                    />
                    <Input
                        label="Bank Name"
                        {...form.register("bankName")}
                        error={form.formState.errors.bankName?.message}
                    />
                    <Input
                        label="Account Number"
                        {...form.register("bankAccount")}
                        error={form.formState.errors.bankAccount?.message}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-4">
                <Link href="/employees">
                    <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" isLoading={isLoading} className="min-w-[120px]">
                    <Save className="mr-2 h-4 w-4" />
                    {submitLabel}
                </Button>
            </div>
        </form>
    )
}
