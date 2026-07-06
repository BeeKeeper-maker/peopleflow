"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Loader2, Upload, X, User, Briefcase, Wallet, MapPin, Phone, TrendingUp, TrendingDown, DollarSign, Check, ChevronLeft, ChevronRight, Fingerprint, Wand2, RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react"
import { useToast } from "@/components/ui/toast"
// Photo preview uses native <img> instead of next/image for defensive rendering
// (any unknown external domain would crash next/image without remotePatterns)
import { employeeSchema, EmployeeFormValues, DEFAULT_EMPLOYEE_VALUES } from "@/lib/validations/employee"

// Draft persistence key
const DRAFT_STORAGE_KEY = "peopleflow_employee_draft_v1"

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
    { id: "access", icon: ShieldCheck, color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", activeColor: "bg-cyan-500 text-white", label: "accessSetup" },
    { id: "financial", icon: Wallet, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", activeColor: "bg-emerald-500 text-white", label: "financialInfo" },
    { id: "address", icon: MapPin, color: "bg-amber-500/10 text-amber-400 border-amber-500/20", activeColor: "bg-amber-500 text-white", label: "addressInfo" },
    { id: "emergency", icon: Phone, color: "bg-rose-500/10 text-rose-400 border-rose-500/20", activeColor: "bg-rose-500 text-white", label: "emergencyContact" },
] as const

// Fields required per step (for validation before advancing)
const STEP_REQUIRED_FIELDS: Record<string, string[]> = {
    personal: ["firstName", "lastName"],
    employment: ["employeeCode", "departmentId", "designationId", "joiningDate"],
    access: [],
    financial: [],
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
    const [hasDraft, setHasDraft] = useState(false)
    const [generatingCode, setGeneratingCode] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const t = useTranslations("SharedComponents.employeeForm")
    const tc = useTranslations("SharedComponents.common")

    // Parse emergency contact from JSON if editing
    const parsedEmergency = initialData?.emergencyContact
        ? (() => { try { return JSON.parse(initialData.emergencyContact) } catch { return {} } })()
        : {}

    const currentSalary = initialData?.salaryAssignments?.[0]

    const form = useForm<EmployeeFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(employeeSchema) as any,
        defaultValues: {
            ...DEFAULT_EMPLOYEE_VALUES,
            ...(initialData ? {
                firstName: initialData.firstName || "",
                lastName: initialData.lastName || "",
                bengaliName: initialData.bengaliName || "",
                firstNameBn: initialData.firstNameBn || "",
                lastNameBn: initialData.lastNameBn || "",
                email: initialData.email || "",
                phone: initialData.phone || "",
                dateOfBirth: initialData.dateOfBirth ? new Date(initialData.dateOfBirth).toISOString().split("T")[0] : "",
                gender: initialData.gender || "",
                bloodGroup: initialData.bloodGroup || "",
                maritalStatus: initialData.maritalStatus || "",
                nationality: initialData.nationality || "Bangladeshi",
                religion: initialData.religion || "",
                nidNumber: initialData.nidNumber || "",
                passportNumber: initialData.passportNumber || "",
                photoUrl: initialData.photoUrl || "",
                fatherName: initialData.fatherName || "",
                fatherNameBn: initialData.fatherNameBn || "",
                motherName: initialData.motherName || "",
                motherNameBn: initialData.motherNameBn || "",
                spouseName: initialData.spouseName || "",
                childrenCount: initialData.childrenCount ?? "",
                employeeCode: initialData.employeeCode || "",
                departmentId: initialData.departmentId || "",
                designationId: initialData.designationId || "",
                joiningDate: initialData.joiningDate ? new Date(initialData.joiningDate).toISOString().split("T")[0] : "",
                employmentType: initialData.employmentType || "permanent",
                employmentStatus: initialData.employmentStatus || "active",
                reportingManagerId: initialData.reportingManagerId || "",
                shiftId: initialData.shiftId || "",
                biometricUserId: initialData.biometricUserId || "",
                pfEnabled: initialData.pfEnabled ?? true,
                grossSalary: currentSalary?.grossSalary || initialData.grossSalary || 0,
                salaryStructureId: currentSalary?.salaryStructureId || "",
                bankName: initialData.bankName || "",
                bankAccount: initialData.accountNumber || initialData.bankAccount || "",
                bankBranch: initialData.bankBranch || "",
                routingNumber: initialData.routingNumber || "",
                tinNumber: initialData.tinNumber || "",
                pfNumber: initialData.pfNumber || "",
                bkashNumber: initialData.bkashNumber || "",
                nagadNumber: initialData.nagadNumber || "",
                isSeniorCitizen: initialData.isSeniorCitizen ?? false,
                isDisabled: initialData.isDisabled ?? false,
                isFreedomFighter: initialData.isFreedomFighter ?? false,
                presentAddress: initialData.presentAddress || "",
                permanentAddress: initialData.permanentAddress || "",
                emergencyContactName: parsedEmergency.name || "",
                emergencyContactPhone: parsedEmergency.phone || "",
                emergencyContactRelation: parsedEmergency.relationship || "",
            } : {}),
        },
    })

    // ── Draft Saving (UX-02) ──────────────────────────────────────────────
    useEffect(() => {
        if (initialData) return
        try {
            const saved = localStorage.getItem(DRAFT_STORAGE_KEY)
            if (saved) setHasDraft(true)
        } catch { /* ignore */ }
    }, [initialData])

    const restoreDraft = useCallback(() => {
        try {
            const saved = localStorage.getItem(DRAFT_STORAGE_KEY)
            if (saved) {
                const draft = JSON.parse(saved)
                form.reset(draft)
                setHasDraft(false)
                addToast({ title: "Draft restored", description: "Your previous progress has been restored.", type: "success" })
            }
        } catch { /* ignore */ }
    }, [form, addToast])

    const dismissDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
        setHasDraft(false)
    }, [])

    // Auto-save draft on change (new employees only)
    useEffect(() => {
        if (initialData) return
        const subscription = form.watch((values) => {
            if (!values.firstName && !values.lastName) return
            try { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values)) } catch { /* ignore */ }
        })
        return () => subscription.unsubscribe()
    }, [form, initialData])

    // ── Unsaved Changes Guard (UX-03) ────────────────────────────────────
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (form.formState.isDirty) { e.preventDefault() }
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [form.formState.isDirty])

    // ── Auto-Generate Employee Code (UX-05) ──────────────────────────────
    const generateCode = useCallback(async () => {
        setGeneratingCode(true)
        try {
            const res = await fetch("/api/employees/next-code")
            if (res.ok) {
                const data = await res.json()
                form.setValue("employeeCode", data.code, { shouldDirty: true })
            }
        } catch { /* ignore */ }
        finally { setGeneratingCode(false) }
    }, [form])

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
            formData.append("folder", "employees")
            const res = await fetch("/api/upload", { method: "POST", body: formData })
            if (!res.ok) throw new Error("Upload failed")
            const data = await res.json()
            const uploadedUrl = data?.data?.url || data?.url
            if (!uploadedUrl) throw new Error("Upload response did not include a file URL")
            form.setValue("photoUrl", uploadedUrl, { shouldDirty: true, shouldValidate: true })
            setPhotoPreview(uploadedUrl)
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
    const watchedStatus = form.watch("employmentStatus")
    const watchedEmail = form.watch("email")
    const watchedManagerId = form.watch("reportingManagerId")
    const watchedBiometricId = form.watch("biometricUserId")
    const selectedStructure = structures.find(s => s.id === watchedStructureId)
    const initialStatus = initialData?.employmentStatus || "active"
    const isOffboardingChange = !!initialData && initialStatus === "active" && watchedStatus !== "active"
    const isReactivationChange = !!initialData && initialStatus !== "active" && watchedStatus === "active"
    const isCompensationDeferred = !watchedGross || Number(watchedGross) <= 0

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

    async function onSubmit(values: EmployeeFormValues) {
        try {
            if (initialData && initialData.employmentStatus !== values.employmentStatus) {
                const confirmed = window.confirm(
                    values.employmentStatus === "active"
                        ? "Reactivate this employee? Their old password/session will stay blocked until they complete a new reset invitation."
                        : "Offboard this employee? Their ESS login, active sessions, and new employee actions will be locked while payroll/history is preserved."
                )
                if (!confirmed) return
            }

            setIsLoading(true)
            const url = initialData ? `/api/employees/${initialData.id}` : "/api/employees"
            const method = initialData ? "PUT" : "POST"

            // Send raw values — server schema handles sanitization & transforms
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!response.ok) {
                // Parse structured error from hardened API
                let errorMsg = tc("somethingWentWrong")
                try {
                    const errData = await response.json()
                    errorMsg = errData.error || errData.message || errorMsg
                } catch {
                    const text = await response.text()
                    if (text) errorMsg = text
                }
                throw new Error(errorMsg)
            }

            const savedEmployee = await response.json()

            // Clear draft on success
            localStorage.removeItem(DRAFT_STORAGE_KEY)

            addToast({
                title: tc("success"),
                description: savedEmployee.reactivationInvitationSent
                    ? "Employee reactivated. A fresh reset invitation is required before ESS access resumes."
                    : initialData ? t("employeeUpdated") : t("employeeCreated"),
                type: "success",
            })
            router.push(savedEmployee?.id ? `/employees/${savedEmployee.id}` : "/employees")
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
                {isOffboardingChange && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
                            <div>
                                <p className="font-semibold">Offboarding action will lock employee access</p>
                                <p className="mt-1 text-sm text-amber-100/80">Changing this employee away from active will disable ESS login, clear active sessions, and block attendance, leave, and expense actions. Payroll and historical records will remain preserved.</p>
                            </div>
                        </div>
                    </div>
                )}
                {isReactivationChange && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                            <div>
                                <p className="font-semibold">Reactivation requires a fresh employee reset</p>
                                <p className="mt-1 text-sm text-emerald-100/80">The employee account will be re-enabled, but old password/session access stays blocked until the employee completes a new reset invitation.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Draft Restoration Banner (UX-02) */}
                {hasDraft && !initialData && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3">
                            <RotateCcw className="h-5 w-5 text-amber-400" />
                            <div>
                                <p className="text-sm font-medium text-foreground">Unsaved draft found</p>
                                <p className="text-xs text-muted-foreground">You have a previous employee form in progress.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={dismissDraft} className="text-muted-foreground hover:text-foreground">Discard</Button>
                            <Button type="button" variant="outline" size="sm" onClick={restoreDraft} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20">Restore Draft</Button>
                        </div>
                    </div>
                )}

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
                                            <img src={photoPreview} alt="Profile" className="absolute inset-0 w-full h-full object-cover" />
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
                                <FormField control={form.control} name="firstNameBn" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("firstNameBn")}</FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="প্রথম নাম (বাংলা)" className={inputCls} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="lastNameBn" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("lastNameBn")}</FormLabel>
                                        <FormControl><Input {...field} disabled={isLoading} placeholder="শেষ নাম (বাংলা)" className={inputCls} /></FormControl>
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
                                <FormField control={form.control} name="religion" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("religion")}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder={t("selectReligion")} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="islam">{t("religionIslam")}</SelectItem>
                                                <SelectItem value="hinduism">{t("religionHinduism")}</SelectItem>
                                                <SelectItem value="buddhism">{t("religionBuddhism")}</SelectItem>
                                                <SelectItem value="christianity">{t("religionChristianity")}</SelectItem>
                                                <SelectItem value="other">{t("religionOther")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            {/* BD Family Information */}
                            <div className="mt-6 pt-5 border-t border-card-border">
                                <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">{t("familyInfoTitle")}</h3>
                                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                    <FormField control={form.control} name="fatherName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("fatherName")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="Father's name" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="fatherNameBn" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("fatherNameBn")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="পিতার নাম" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="motherName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("motherName")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="Mother's name" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="motherNameBn" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("motherNameBn")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="মাতার নাম" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="spouseName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("spouseName")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="Spouse's name" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="childrenCount" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("childrenCount")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={field.value ?? ""}
                                                    onChange={(e) => field.onChange(e.target.value === "" ? "" : e.target.value)}
                                                    disabled={isLoading}
                                                    placeholder="0"
                                                    className={inputCls}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
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
                                        <div className="flex gap-2">
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="EMP-001" className={`${inputCls} flex-1`} /></FormControl>
                                            {!initialData && (
                                                <Button type="button" variant="outline" size="icon" onClick={generateCode} disabled={generatingCode || isLoading}
                                                    className="border-card-border bg-transparent hover:bg-hover shrink-0 h-10 w-10" title="Auto-generate code">
                                                    {generatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 text-violet-400" />}
                                                </Button>
                                            )}
                                        </div>
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
                                            clearable
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
                                            clearable
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Biometric Device ID */}
                                <FormField control={form.control} name="biometricUserId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium flex items-center gap-1.5">
                                            <Fingerprint className="h-3.5 w-3.5 text-violet-400" />
                                            {t("biometricId")}
                                        </FormLabel>
                                        <FormControl>
                                            <Input {...field} disabled={isLoading} placeholder="e.g., 1, 2, 101" className={inputCls} />
                                        </FormControl>
                                        <p className="text-[11px] text-muted-foreground/70 mt-1">{t("biometricIdHint")}</p>
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

                    {/* ─── Step 3: Access & Approval Setup ─── */}
                    {currentStep === 2 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">Access & Approval Setup</h2>
                                    <p className="text-xs text-muted-foreground">Login access, reporting manager, and biometric readiness</p>
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-3">
                                <div className={`rounded-xl border p-4 ${watchedEmail ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                                    <div className="flex items-start gap-3">
                                        {watchedEmail ? <Check className="mt-0.5 h-5 w-5 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />}
                                        <div>
                                            <p className="font-semibold text-foreground">ESS login account</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {watchedEmail
                                                    ? "An employee login will be created with Employee access. Admin can promote to Manager/HR from Settings → Access Control after saving."
                                                    : "No email means no ESS login. This is okay for non-portal staff, but leave/attendance self-service will not work."
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className={`rounded-xl border p-4 ${watchedManagerId ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                                    <div className="flex items-start gap-3">
                                        {watchedManagerId ? <Check className="mt-0.5 h-5 w-5 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />}
                                        <div>
                                            <p className="font-semibold text-foreground">Leave approval routing</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {watchedManagerId
                                                    ? "Reporting manager is selected. Leave requests can route to the manager first, then HR/Admin according to workflow."
                                                    : "No reporting manager selected. HR/Admin may still see requests, but manager approval flow will be unclear."
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className={`rounded-xl border p-4 ${watchedBiometricId ? "border-emerald-500/30 bg-emerald-500/10" : "border-card-border bg-hover"}`}>
                                    <div className="flex items-start gap-3">
                                        <Fingerprint className={`mt-0.5 h-5 w-5 ${watchedBiometricId ? "text-emerald-400" : "text-muted-foreground"}`} />
                                        <div>
                                            <p className="font-semibold text-foreground">Biometric mapping</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {watchedBiometricId
                                                    ? "Biometric user ID is set. It must match the device user ID exactly for attendance sync."
                                                    : "Optional now. Add the device user ID later before office biometric acceptance testing."
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-400" />
                                    <div>
                                        <p className="font-semibold text-foreground">Best-practice office flow</p>
                                        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                                            <li>Create the employee profile with email, department, designation, joining date, and manager.</li>
                                            <li>Save the employee. The default login role is Employee for safety.</li>
                                            <li>Go to Settings → Access Control to promote selected users to Manager, HR Admin, or Office Admin.</li>
                                            <li>Review setup issues there before handover so approval routing is clean.</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Step 4: Financial Information ─── */}
                    {currentStep === 3 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400">
                                    <Wallet className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">{t("financialInfo")}</h2>
                                    <p className="text-xs text-muted-foreground">Compensation can be deferred for trial, short-term, or evaluation employees.</p>
                                </div>
                            </div>

                            <div className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-300" />
                                    <div className="space-y-1">
                                        <p className="font-semibold text-blue-50">Deferred compensation setup</p>
                                        <p className="text-blue-100/80">You may save the employee without salary now. Attendance, leave, ESS access, and biometric mapping will continue to work. Payroll, payslips, PF, bonus, and salary documents will require active compensation before processing.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-5 md:grid-cols-2 mb-5">
                                <FormField control={form.control} name="grossSalary" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-foreground text-sm font-medium">{t("grossSalary")} <span className="text-xs font-normal text-muted-foreground">(optional)</span></FormLabel>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">৳</span>
                                            <FormControl><Input type="number" {...field} disabled={isLoading} className={`${inputCls} pl-8`} placeholder="0" /></FormControl>
                                        </div>
                                        {isCompensationDeferred && (
                                            <p className="text-xs text-amber-300">Salary is not set yet. This employee will be excluded from payroll until compensation is assigned.</p>
                                        )}
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
                                            clearable
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
                                                <p className="text-lg font-semibold tabular-nums text-emerald-400">৳{salaryBreakdown.basic.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("houseRent")}</span>
                                                </div>
                                                <p className="text-lg font-semibold tabular-nums text-emerald-400">৳{salaryBreakdown.hra.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("medical")}</span>
                                                </div>
                                                <p className="text-lg font-semibold tabular-nums text-emerald-400">৳{salaryBreakdown.medical.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("conveyance")}</span>
                                                </div>
                                                <p className="text-lg font-semibold tabular-nums text-emerald-400">৳{salaryBreakdown.conveyance.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingDown className="h-3 w-3 text-red-400" />
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("pfDeduction")}</span>
                                                </div>
                                                <p className="text-lg font-semibold tabular-nums text-red-400">-৳{salaryBreakdown.pf.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-1 p-3 -m-1 rounded-xl bg-linear-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/20">
                                                <span className="text-xs text-blue-300 uppercase tracking-wider font-medium">{t("netSalary")}</span>
                                                <p className="text-xl font-display font-bold tabular-nums text-blue-400">৳{salaryBreakdown.net.toLocaleString()}</p>
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

                            {/* BD Mobile Banking */}
                            <div className="pt-5 mt-5 border-t border-card-border">
                                <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">{t("mobileBankingTitle")}</h3>
                                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                    <FormField control={form.control} name="bkashNumber" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("bkashNumber")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="01XXXXXXXXX" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="nagadNumber" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground text-sm font-medium">{t("nagadNumber")}</FormLabel>
                                            <FormControl><Input {...field} disabled={isLoading} placeholder="01XXXXXXXXX" className={inputCls} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                            {/* BD Tax Exemption */}
                            <div className="pt-5 mt-5 border-t border-card-border">
                                <h3 className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{t("taxExemptionTitle")}</h3>
                                <p className="text-xs text-muted-foreground mb-4">{t("taxExemptionDesc")}</p>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <FormField control={form.control} name="isSeniorCitizen" render={({ field }) => (
                                        <FormItem>
                                            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300 ${field.value ? "border-blue-500/30 bg-blue-500/5" : "border-card-border bg-hover"}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!field.value}
                                                    onChange={(e) => field.onChange(e.target.checked)}
                                                    disabled={isLoading}
                                                    className="mt-0.5 h-4 w-4 rounded border-card-border accent-blue-500"
                                                />
                                                <div>
                                                    <span className="block text-sm font-medium text-foreground">{t("isSeniorCitizen")}</span>
                                                    <span className="block text-[11px] text-muted-foreground">{t("isSeniorCitizenDesc")}</span>
                                                </div>
                                            </label>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="isDisabled" render={({ field }) => (
                                        <FormItem>
                                            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300 ${field.value ? "border-blue-500/30 bg-blue-500/5" : "border-card-border bg-hover"}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!field.value}
                                                    onChange={(e) => field.onChange(e.target.checked)}
                                                    disabled={isLoading}
                                                    className="mt-0.5 h-4 w-4 rounded border-card-border accent-blue-500"
                                                />
                                                <div>
                                                    <span className="block text-sm font-medium text-foreground">{t("isDisabled")}</span>
                                                    <span className="block text-[11px] text-muted-foreground">{t("isDisabledDesc")}</span>
                                                </div>
                                            </label>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="isFreedomFighter" render={({ field }) => (
                                        <FormItem>
                                            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300 ${field.value ? "border-blue-500/30 bg-blue-500/5" : "border-card-border bg-hover"}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!field.value}
                                                    onChange={(e) => field.onChange(e.target.checked)}
                                                    disabled={isLoading}
                                                    className="mt-0.5 h-4 w-4 rounded border-card-border accent-blue-500"
                                                />
                                                <div>
                                                    <span className="block text-sm font-medium text-foreground">{t("isFreedomFighter")}</span>
                                                    <span className="block text-[11px] text-muted-foreground">{t("isFreedomFighterDesc")}</span>
                                                </div>
                                            </label>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Step 5: Address ─── */}
                    {currentStep === 4 && (
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

                    {/* ─── Step 6: Emergency Contact ─── */}
                    {currentStep === 5 && (
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
