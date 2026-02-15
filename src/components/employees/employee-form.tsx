"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
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
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Loader2, Upload, X, User, Briefcase, Wallet, MapPin, Phone, TrendingUp, TrendingDown, DollarSign, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Image from "next/image"

const formSchema = z.object({
    // Personal
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
    bengaliName: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    bloodGroup: z.string().optional(),
    maritalStatus: z.string().optional(),
    nationality: z.string().optional(),
    nidNumber: z.string().optional(),
    passportNumber: z.string().optional(),
    photoUrl: z.string().optional(),

    // Employment
    employeeCode: z.string().min(1, "Employee code is required"),
    departmentId: z.string().min(1, "Department is required"),
    designationId: z.string().min(1, "Designation is required"),
    joiningDate: z.string().min(1, "Joining date is required"),
    employmentType: z.string().default("permanent"),
    employmentStatus: z.string().default("active"),
    reportingManagerId: z.string().optional(),
    shiftId: z.string().optional(),
    pfEnabled: z.boolean().default(true),

    // Financial
    grossSalary: z.coerce.number().min(0, "Gross salary is required"),
    salaryStructureId: z.string().optional(),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
    bankBranch: z.string().optional(),
    routingNumber: z.string().optional(),
    tinNumber: z.string().optional(),
    pfNumber: z.string().optional(),

    // Address & Emergency
    presentAddress: z.string().optional(),
    permanentAddress: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    emergencyContactRelation: z.string().optional(),
})

interface Department { id: string; name: string }
interface Designation { id: string; name: string }
interface Shift { id: string; name: string }
interface SalaryStructure {
    id: string; name: string; code?: string
    basicPercentage: number; houseRentPercent: number
    medicalPercent: number; conveyanceFixed: number
    pfEmployeePercent: number
}
interface ManagerOption { id: string; firstName: string; lastName: string; employeeCode: string }

interface EmployeeFormProps {
    initialData?: any
}

// ─── Step definitions ───
const STEPS = [
    { id: "personal", icon: User, color: "bg-blue-500/10 text-blue-400 border-blue-500/20", activeColor: "bg-blue-500 text-white", label: "personalInfo" },
    { id: "employment", icon: Briefcase, color: "bg-violet-500/10 text-violet-400 border-violet-500/20", activeColor: "bg-violet-500 text-white", label: "employmentDetails" },
    { id: "financial", icon: Wallet, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", activeColor: "bg-emerald-500 text-white", label: "financialInfo" },
    { id: "address", icon: MapPin, color: "bg-amber-500/10 text-amber-400 border-amber-500/20", activeColor: "bg-amber-500 text-white", label: "addressInfo" },
    { id: "emergency", icon: Phone, color: "bg-rose-500/10 text-rose-400 border-rose-500/20", activeColor: "bg-rose-500 text-white", label: "emergencyContact" },
] as const

// Fields required per step (for validation before advancing)
const STEP_REQUIRED_FIELDS: Record<string, string[]> = {
    personal: ["firstName", "lastName"],
    employment: ["employeeCode", "departmentId", "designationId", "joiningDate"],
    financial: ["grossSalary"],
    address: [],
    emergency: [],
}

export function EmployeeForm({ initialData }: EmployeeFormProps) {
    const router = useRouter()
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
    const [departments, setDepartments] = useState<Department[]>([])
    const [designations, setDesignations] = useState<Designation[]>([])
    const [shifts, setShifts] = useState<Shift[]>([])
    const [structures, setStructures] = useState<SalaryStructure[]>([])
    const [managers, setManagers] = useState<ManagerOption[]>([])
    const [uploading, setUploading] = useState(false)
    const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.photoUrl || null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const t = useTranslations("SharedComponents.employeeForm")
    const tc = useTranslations("SharedComponents.common")

    // Parse emergency contact from JSON if editing
    const parsedEmergency = initialData?.emergencyContact
        ? (() => { try { return JSON.parse(initialData.emergencyContact) } catch { return {} } })()
        : {}

    const currentSalary = initialData?.salaryAssignments?.[0]

    const form = useForm<z.infer<typeof formSchema>>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            firstName: initialData?.firstName || "",
            lastName: initialData?.lastName || "",
            bengaliName: initialData?.bengaliName || "",
            email: initialData?.email || "",
            phone: initialData?.phone || "",
            dateOfBirth: initialData?.dateOfBirth ? new Date(initialData.dateOfBirth).toISOString().split("T")[0] : "",
            gender: initialData?.gender || "",
            bloodGroup: initialData?.bloodGroup || "",
            maritalStatus: initialData?.maritalStatus || "",
            nationality: initialData?.nationality || "",
            nidNumber: initialData?.nidNumber || "",
            passportNumber: initialData?.passportNumber || "",
            employeeCode: initialData?.employeeCode || "",
            departmentId: initialData?.departmentId || "",
            designationId: initialData?.designationId || "",
            joiningDate: initialData?.joiningDate ? new Date(initialData.joiningDate).toISOString().split("T")[0] : "",
            employmentType: initialData?.employmentType || "permanent",
            employmentStatus: initialData?.employmentStatus || "active",
            reportingManagerId: initialData?.reportingManagerId || "",
            shiftId: initialData?.shiftId || "",
            pfEnabled: initialData?.pfEnabled ?? true,
            grossSalary: currentSalary?.grossSalary || initialData?.grossSalary || 0,
            salaryStructureId: currentSalary?.salaryStructureId || "",
            bankName: initialData?.bankName || "",
            bankAccount: initialData?.accountNumber || initialData?.bankAccount || "",
            bankBranch: initialData?.bankBranch || "",
            routingNumber: initialData?.routingNumber || "",
            tinNumber: initialData?.tinNumber || "",
            pfNumber: initialData?.pfNumber || "",
            presentAddress: initialData?.presentAddress || "",
            permanentAddress: initialData?.permanentAddress || "",
            emergencyContactName: parsedEmergency.name || "",
            emergencyContactPhone: parsedEmergency.phone || "",
            emergencyContactRelation: parsedEmergency.relationship || "",
            photoUrl: initialData?.photoUrl || "",
        },
    })

    useEffect(() => {
        fetch("/api/departments?all=true")
            .then((res) => res.json())
            .then((data) => setDepartments(data.departments || data || []))
            .catch(console.error)
        fetch("/api/designations?all=true")
            .then((res) => res.json())
            .then((data) => setDesignations(data.designations || data || []))
            .catch(console.error)
        fetch("/api/shifts")
            .then((res) => res.json())
            .then((data) => setShifts(data.data || data || []))
            .catch(console.error)
        fetch("/api/payroll/structures")
            .then((res) => res.json())
            .then((data) => setStructures(data.data || data || []))
            .catch(console.error)
        fetch("/api/employees?limit=100&status=active")
            .then((res) => res.json())
            .then((data) => setManagers(data.data || data || []))
            .catch(console.error)
    }, [])

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            addToast({ title: tc("error"), description: t("fileSizeError"), type: "error" })
            return
        }
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const res = await fetch("/api/upload", { method: "POST", body: formData })
            if (!res.ok) throw new Error("Upload failed")
            const data = await res.json()
            form.setValue("photoUrl", data.url)
            setPhotoPreview(data.url)
            addToast({ title: t("photoUploaded"), description: t("photoUploadedDesc"), type: "success" })
        } catch {
            addToast({ title: t("uploadFailed"), description: t("uploadFailedDesc"), type: "error" })
        } finally {
            setUploading(false)
        }
    }

    // Salary breakdown
    const watchedGross = form.watch("grossSalary")
    const watchedStructureId = form.watch("salaryStructureId")
    const selectedStructure = structures.find(s => s.id === watchedStructureId)

    const salaryBreakdown = selectedStructure && watchedGross > 0 ? (() => {
        const basic = (watchedGross * selectedStructure.basicPercentage) / 100
        const hra = (basic * selectedStructure.houseRentPercent) / 100
        const medical = (basic * selectedStructure.medicalPercent) / 100
        const conveyance = selectedStructure.conveyanceFixed
        const pf = (basic * selectedStructure.pfEmployeePercent) / 100
        return { basic: Math.round(basic), hra: Math.round(hra), medical: Math.round(medical), conveyance: Math.round(conveyance), pf: Math.round(pf), net: Math.round(watchedGross - pf) }
    })() : null

    // Step navigation
    const validateCurrentStep = useCallback(async () => {
        const stepId = STEPS[currentStep].id
        const requiredFields = STEP_REQUIRED_FIELDS[stepId] || []
        if (requiredFields.length === 0) return true
        const result = await form.trigger(requiredFields as any)
        return result
    }, [currentStep, form])

    const goToStep = useCallback((step: number) => {
        setCurrentStep(step)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    const nextStep = useCallback(async () => {
        const isValid = await validateCurrentStep()
        if (!isValid) {
            addToast({ title: tc("error"), description: "Please fill in all required fields", type: "error" })
            return
        }
        setCompletedSteps(prev => new Set([...prev, currentStep]))
        if (currentStep < STEPS.length - 1) {
            goToStep(currentStep + 1)
        }
    }, [currentStep, validateCurrentStep, addToast, tc, goToStep])

    const prevStep = useCallback(() => {
        if (currentStep > 0) {
            goToStep(currentStep - 1)
        }
    }, [currentStep, goToStep])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            setIsLoading(true)
            const url = initialData ? `/api/employees/${initialData.id}` : "/api/employees"
            const method = initialData ? "PUT" : "POST"

            const emergencyContact = values.emergencyContactName
                ? JSON.stringify({
                    name: values.emergencyContactName,
                    phone: values.emergencyContactPhone,
                    relationship: values.emergencyContactRelation,
                })
                : undefined

            const {
                emergencyContactName: _ecName,
                emergencyContactPhone: _ecPhone,
                emergencyContactRelation: _ecRel,
                ...rest
            } = values

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...rest, emergencyContact }),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(error || tc("somethingWentWrong"))
            }

            addToast({
                title: tc("success"),
                description: initialData ? t("employeeUpdated") : t("employeeCreated"),
                type: "success",
            })
            router.push("/employees")
            router.refresh()
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

    // Shared classes
    const inputCls = "bg-hover border-card-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
    const selectTriggerCls = "bg-hover border-card-border text-foreground focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* ═══════════════════════════════════════════════════════════
                    STEP INDICATOR — Horizontal Stepper
                   ═══════════════════════════════════════════════════════════ */}
                <div className="rounded-2xl border border-card-border bg-card-bg backdrop-blur-sm p-4 overflow-x-auto">
                    <div className="flex items-center justify-between min-w-[600px]">
                        {STEPS.map((step, index) => {
                            const StepIcon = step.icon
                            const isActive = index === currentStep
                            const isCompleted = completedSteps.has(index)
                            const isPast = index < currentStep

                            return (
                                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                                    {/* Step circle + label */}
                                    <button
                                        type="button"
                                        onClick={() => goToStep(index)}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-300 ${isActive
                                            ? "bg-hover border border-card-border shadow-sm"
                                            : "hover:bg-hover"
                                            }`}
                                    >
                                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-300 ${isActive
                                            ? step.activeColor
                                            : isCompleted || isPast
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                : step.color
                                            }`}>
                                            {isCompleted || isPast ? (
                                                <Check className="h-4 w-4" />
                                            ) : (
                                                <StepIcon className="h-4 w-4" />
                                            )}
                                        </div>
                                        <div className="hidden lg:block text-left">
                                            <p className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                                Step {index + 1}
                                            </p>
                                            <p className={`text-[11px] ${isActive ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                                                {t(step.label)}
                                            </p>
                                        </div>
                                    </button>
                                    {/* Connector line */}
                                    {index < STEPS.length - 1 && (
                                        <div className={`flex-1 h-px mx-2 transition-colors duration-300 ${isPast || isCompleted ? "bg-emerald-500/30" : "bg-card-border"
                                            }`} />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    STEP CONTENT — Card Container
                   ═══════════════════════════════════════════════════════════ */}
                <div className="rounded-2xl border border-card-border bg-card-bg backdrop-blur-sm p-6 min-h-[420px] transition-all duration-300">

                    {/* ─── Step 1: Personal Information ─── */}
                    {currentStep === 0 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">{t("personalInfo")}</h2>
                                    <p className="text-xs text-muted-foreground">Basic details and identity information</p>
                                </div>
                            </div>

                            {/* Photo Upload */}
                            <div className="flex items-center gap-6 mb-6 p-4 rounded-xl bg-hover border border-card-border">
                                <div className="relative group">
                                    <div className="relative h-20 w-20 rounded-2xl overflow-hidden border-2 border-card-border bg-hover ring-2 ring-blue-500/10 transition-all duration-300 group-hover:ring-blue-500/30">
                                        {photoPreview ? (
                                            <Image src={photoPreview} alt="Profile" fill className="object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                                <User className="h-8 w-8" />
                                            </div>
                                        )}
                                    </div>
                                    {photoPreview && (
                                        <button type="button" onClick={() => { setPhotoPreview(null); form.setValue("photoUrl", "") }}
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors shadow-lg">
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                                <div>
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                        className="border-card-border bg-transparent hover:bg-hover gap-2">
                                        <Upload className="h-4 w-4" />
                                        {uploading ? t("uploading") : t("uploadPhoto")}
                                    </Button>
                                    <p className="mt-2 text-xs text-muted-foreground">{t("photoRecommendation")}</p>
                                </div>
                            </div>

                            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                <FormField control={form.control} name="firstName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("firstName")} <span className="text-red-400">*</span></FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="Enter first name" className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="lastName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("lastName")} <span className="text-red-400">*</span></FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="Enter last name" className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="bengaliName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("bengaliName")}</FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="বাংলা নাম" className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("email")}</FormLabel>
                                        <FormControl><Input type="email" {...field} disabled={isLoading} placeholder="name@company.com" className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="phone" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("phone")}</FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="+880 1XXX-XXXXXX" className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("dateOfBirth")}</FormLabel>
                                        <FormControl><Input type="date" {...field} disabled={isLoading} className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="gender" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("gender")}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder={t("gender")} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="male">{t("male")}</SelectItem>
                                                <SelectItem value="female">{t("female")}</SelectItem>
                                                <SelectItem value="other">{t("other")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("bloodGroup")}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder={t("selectBloodGroup")} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(bg => (
                                                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="maritalStatus" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("maritalStatus")}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder={t("maritalStatus")} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="single">{t("single")}</SelectItem>
                                                <SelectItem value="married">{t("married")}</SelectItem>
                                                <SelectItem value="divorced">{t("divorced")}</SelectItem>
                                                <SelectItem value="widowed">{t("widowed")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="nationality" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("nationality")}</FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="nidNumber" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("nationalId")}</FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="NID / Smart Card No." className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="passportNumber" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("passportNumber")}</FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="Passport No." className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    )}

                    {/* ─── Step 2: Employment Details ─── */}
                    {currentStep === 1 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400">
                                    <Briefcase className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">{t("employmentDetails")}</h2>
                                    <p className="text-xs text-muted-foreground">Role, department and work schedule</p>
                                </div>
                            </div>

                            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                <FormField control={form.control} name="employeeCode" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("employeeCode")} <span className="text-red-400">*</span></FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="EMP-001" className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Department — Searchable */}
                                <FormField control={form.control} name="departmentId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("department")} <span className="text-red-400">*</span></FormLabel>
                                        <SearchableSelect
                                            options={departments.map(d => ({ value: d.id, label: d.name }))}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder={t("selectDepartment")}
                                            searchPlaceholder="Search department..."
                                            disabled={isLoading}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Designation — Searchable */}
                                <FormField control={form.control} name="designationId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("designation")} <span className="text-red-400">*</span></FormLabel>
                                        <SearchableSelect
                                            options={designations.map(d => ({ value: d.id, label: d.name }))}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder={t("selectDesignation")}
                                            searchPlaceholder="Search designation..."
                                            disabled={isLoading}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="joiningDate" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("joiningDate")} <span className="text-red-400">*</span></FormLabel>
                                        <FormControl><Input type="date" {...field} disabled={isLoading} className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="employmentType" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("employmentType")}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="permanent">{t("permanent")}</SelectItem>
                                                <SelectItem value="contractual">{t("contractual")}</SelectItem>
                                                <SelectItem value="intern">{t("intern")}</SelectItem>
                                                <SelectItem value="probation">{t("probation")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="employmentStatus" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("employmentStatus")}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="active">{t("statusActive")}</SelectItem>
                                                <SelectItem value="resigned">{t("statusResigned")}</SelectItem>
                                                <SelectItem value="terminated">{t("statusTerminated")}</SelectItem>
                                                <SelectItem value="retired">{t("statusRetired")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Manager — Searchable */}
                                <FormField control={form.control} name="reportingManagerId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("reportingManager")}</FormLabel>
                                        <SearchableSelect
                                            options={managers
                                                .filter(m => m.id !== initialData?.id)
                                                .map(m => ({
                                                    value: m.id,
                                                    label: `${m.firstName} ${m.lastName}`,
                                                    sublabel: m.employeeCode,
                                                }))}
                                            value={field.value || ""}
                                            onValueChange={field.onChange}
                                            placeholder={t("selectManager")}
                                            searchPlaceholder="Search manager..."
                                            disabled={isLoading}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Shift — Searchable */}
                                <FormField control={form.control} name="shiftId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("shift")}</FormLabel>
                                        <SearchableSelect
                                            options={shifts.map(s => ({ value: s.id, label: s.name }))}
                                            value={field.value || ""}
                                            onValueChange={field.onChange}
                                            placeholder={t("selectShift")}
                                            searchPlaceholder="Search shift..."
                                            disabled={isLoading}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* PF Toggle */}
                                <FormField control={form.control} name="pfEnabled" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("pfEnabled")}</FormLabel>
                                        <div onClick={() => field.onChange(!field.value)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300 ${field.value ? "border-blue-500/30 bg-blue-500/5" : "border-card-border bg-hover"}
                                                }`}>
                                            <button type="button" role="switch" aria-checked={field.value}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${field.value ? "bg-blue-600" : "bg-gray-600"}`}>
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${field.value ? "translate-x-6" : "translate-x-1"}`} />
                                            </button>
                                            <span className={`text-sm font-medium ${field.value ? "text-blue-400" : "text-muted-foreground"}`}>
                                                {field.value ? t("pfEnabledYes") : t("pfEnabledNo")}
                                            </span>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    )}

                    {/* ─── Step 3: Financial Information ─── */}
                    {currentStep === 2 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400">
                                    <Wallet className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">{t("financialInfo")}</h2>
                                    <p className="text-xs text-muted-foreground">Salary, banking and tax details</p>
                                </div>
                            </div>

                            <div className="grid gap-5 md:grid-cols-2 mb-5">
                                <FormField control={form.control} name="grossSalary" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("grossSalary")} <span className="text-red-400">*</span></FormLabel>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">৳</span>
                                            <FormControl><Input type="number" {...field} disabled={isLoading} className={`${inputCls} pl-8`} placeholder="0" /></FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="salaryStructureId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("salaryStructure")}</FormLabel>
                                        <SearchableSelect
                                            options={structures.map(s => ({
                                                value: s.id,
                                                label: `${s.name}${s.code ? ` (${s.code})` : ""}`,
                                            }))}
                                            value={field.value || ""}
                                            onValueChange={field.onChange}
                                            placeholder={t("selectStructure")}
                                            searchPlaceholder="Search structure..."
                                            disabled={isLoading}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            {/* Salary Breakdown */}
                            {salaryBreakdown && (
                                <div className="mb-6 rounded-xl overflow-hidden border border-card-border">
                                    <div className="px-5 py-3 bg-linear-to-r from-blue-500/10 via-violet-500/5 to-transparent border-b border-card-border">
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="h-4 w-4 text-blue-400" />
                                            <h3 className="text-sm font-semibold text-foreground">{t("salaryBreakdownPreview")}</h3>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-hover">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("basic")}</span>
                                                </div>
                                                <p className="text-lg font-semibold text-emerald-400">৳{salaryBreakdown.basic.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("houseRent")}</span>
                                                </div>
                                                <p className="text-lg font-semibold text-emerald-400">৳{salaryBreakdown.hra.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("medical")}</span>
                                                </div>
                                                <p className="text-lg font-semibold text-emerald-400">৳{salaryBreakdown.medical.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("conveyance")}</span>
                                                </div>
                                                <p className="text-lg font-semibold text-emerald-400">৳{salaryBreakdown.conveyance.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingDown className="h-3 w-3 text-red-400" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("pfDeduction")}</span>
                                                </div>
                                                <p className="text-lg font-semibold text-red-400">-৳{salaryBreakdown.pf.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1 p-3 -m-1 rounded-xl bg-linear-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/20">
                                                <span className="text-xs text-blue-300 uppercase tracking-wider font-medium">{t("netSalary")}</span>
                                                <p className="text-xl font-bold text-blue-400">৳{salaryBreakdown.net.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Banking Details */}
                            <div className="pt-4 border-t border-card-border">
                                <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Banking Details</h3>
                                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                    <FormField control={form.control} name="bankName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("bankName")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="Bank name" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="bankBranch" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("bankBranch")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="Branch name" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="bankAccount" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("accountNumber")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="Account number" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="routingNumber" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("routingNumber")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="Routing number" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="tinNumber" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("tinNumber")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="TIN Number" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="pfNumber" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("pfNumber")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="PF Account No." className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Step 4: Address ─── */}
                    {currentStep === 3 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">{t("addressInfo")}</h2>
                                    <p className="text-xs text-muted-foreground">Present and permanent address</p>
                                </div>
                            </div>
                            <div className="grid gap-5 md:grid-cols-2">
                                <FormField control={form.control} name="presentAddress" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("presentAddress")}</FormLabel>
                                        <FormControl>
                                            <textarea {...field} disabled={isLoading} rows={4} placeholder="Enter present address..."
                                                className={`flex w-full rounded-xl border px-3 py-2.5 text-sm resize-none focus:outline-none ${inputCls}`} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="permanentAddress" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("permanentAddress")}</FormLabel>
                                        <FormControl>
                                            <textarea {...field} disabled={isLoading} rows={4} placeholder="Enter permanent address..."
                                                className={`flex w-full rounded-xl border px-3 py-2.5 text-sm resize-none focus:outline-none ${inputCls}`} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    )}

                    {/* ─── Step 5: Emergency Contact ─── */}
                    {currentStep === 4 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400">
                                    <Phone className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">{t("emergencyContact")}</h2>
                                    <p className="text-xs text-muted-foreground">Person to contact in case of emergency</p>
                                </div>
                            </div>
                            <div className="grid gap-5 md:grid-cols-3">
                                <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("contactName")}</FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="Full name" className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("contactPhone")}</FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="+880 1XXX-XXXXXX" className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="emergencyContactRelation" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("contactRelation")}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder={t("selectRelation")} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="spouse">{t("spouse")}</SelectItem>
                                                <SelectItem value="parent">{t("parent")}</SelectItem>
                                                <SelectItem value="sibling">{t("sibling")}</SelectItem>
                                                <SelectItem value="child">{t("child")}</SelectItem>
                                                <SelectItem value="friend">{t("friend")}</SelectItem>
                                                <SelectItem value="other">{t("otherRelation")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    FOOTER — Navigation + Submit
                   ═══════════════════════════════════════════════════════════ */}
                <div className="rounded-2xl border border-card-border bg-card-bg backdrop-blur-sm p-4">
                    <div className="flex items-center justify-between">
                        {/* Left — Back / Cancel */}
                        <div>
                            {currentStep === 0 ? (
                                <Button type="button" variant="outline" onClick={() => router.push("/employees")}
                                    className="border-card-border bg-transparent hover:bg-hover gap-2">
                                    {tc("cancel")}
                                </Button>
                            ) : (
                                <Button type="button" variant="outline" onClick={prevStep}
                                    className="border-card-border bg-transparent hover:bg-hover gap-2">
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                            )}
                        </div>

                        {/* Center — Step counter */}
                        <span className="text-sm text-muted-foreground hidden sm:block">
                            Step {currentStep + 1} of {STEPS.length}
                        </span>

                        {/* Right — Next / Submit */}
                        <div>
                            {currentStep < STEPS.length - 1 ? (
                                <Button type="button" onClick={nextStep}
                                    className="bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/20 gap-2 px-6 transition-all duration-300">
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button type="submit" disabled={isLoading}
                                    className="bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/20 gap-2 px-8 transition-all duration-300">
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {initialData ? tc("save") : t("createEmployee")}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </Form>
    )
}
