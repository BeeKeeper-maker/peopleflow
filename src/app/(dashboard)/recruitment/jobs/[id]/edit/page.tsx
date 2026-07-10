"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Briefcase, Calendar, Loader2, MapPin, Save, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

interface Department { id: string; name: string }
interface Designation { id: string; name: string }

const emptyToString = (value: unknown) => value == null ? "" : String(value)
const toDateInput = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : ""

export default function EditJobPage() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const { addToast } = useToast()
    const tShared = useTranslations("SharedComponents")
    const t = useTranslations("FormRecruitmentJobs")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [departments, setDepartments] = useState<Department[]>([])
    const [designations, setDesignations] = useState<Designation[]>([])
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        requirements: "",
        responsibilities: "",
        employmentType: "full_time",
        experience: "",
        education: "",
        skills: "",
        salaryMin: "",
        salaryMax: "",
        showSalary: false,
        location: "",
        isRemote: false,
        openings: "1",
        closesAt: "",
        departmentId: "",
        designationId: "",
    })

    useEffect(() => {
        const load = async () => {
            try {
                const [jobRes, deptRes, desigRes] = await Promise.all([
                    fetch(`/api/recruitment/jobs/${params.id}`),
                    fetch("/api/departments"),
                    fetch("/api/designations"),
                ])
                if (!jobRes.ok) throw new Error("Job not found")
                const job = await jobRes.json()
                if (deptRes.ok) setDepartments(await deptRes.json())
                if (desigRes.ok) setDesignations(await desigRes.json())
                setFormData({
                    title: emptyToString(job.title),
                    description: emptyToString(job.description),
                    requirements: emptyToString(job.requirements),
                    responsibilities: emptyToString(job.responsibilities),
                    employmentType: emptyToString(job.employmentType || "full_time"),
                    experience: emptyToString(job.experience),
                    education: emptyToString(job.education),
                    skills: emptyToString(job.skills),
                    salaryMin: emptyToString(job.salaryMin),
                    salaryMax: emptyToString(job.salaryMax),
                    showSalary: Boolean(job.showSalary),
                    location: emptyToString(job.location),
                    isRemote: Boolean(job.isRemote),
                    openings: emptyToString(job.openings || 1),
                    closesAt: toDateInput(job.closesAt),
                    departmentId: emptyToString(job.departmentId),
                    designationId: emptyToString(job.designationId),
                })
            } catch {
                addToast({ title: tShared("failedLoadData"), type: "error" })
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.id, addToast, tShared])

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (status?: "draft" | "open" | "paused" | "closed") => {
        if (!formData.title || !formData.description || !formData.employmentType) {
            addToast({ title: tShared("requiredFieldsError"), type: "error" })
            return
        }
        setSaving(true)
        try {
            const res = await fetch(`/api/recruitment/jobs/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    salaryMin: formData.salaryMin ? Number(formData.salaryMin) : null,
                    salaryMax: formData.salaryMax ? Number(formData.salaryMax) : null,
                    openings: Number(formData.openings) || 1,
                    closesAt: formData.closesAt || null,
                    departmentId: formData.departmentId || null,
                    designationId: formData.designationId || null,
                    ...(status ? { status } : {}),
                }),
            })
            if (!res.ok) throw new Error("Save failed")
            addToast({ title: tShared("updateSuccess"), type: "success" })
            router.push(`/recruitment/jobs/${params.id}`)
        } catch {
            addToast({ title: tShared("updateFailed"), type: "error" })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-4">
                <Link href={`/recruitment/jobs/${params.id}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t("editTitle")}</h1>
                    <p className="text-muted-foreground mt-1">{t("editSubtitle")}</p>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-blue-400" />{t("jobDetails")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2"><Label>{t("jobTitle")}</Label><Input value={formData.title} onChange={(e) => handleChange("title", e.target.value)} className="mt-1.5" /></div>
                        <div><Label>{t("department")}</Label><Select value={formData.departmentId} onValueChange={(v) => handleChange("departmentId", v)}><SelectTrigger className="mt-1.5"><SelectValue placeholder={t("selectDepartment")} /></SelectTrigger><SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>{t("designation")}</Label><Select value={formData.designationId} onValueChange={(v) => handleChange("designationId", v)}><SelectTrigger className="mt-1.5"><SelectValue placeholder={t("selectDesignation")} /></SelectTrigger><SelectContent>{designations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>{t("employmentType")}</Label><Select value={formData.employmentType} onValueChange={(v) => handleChange("employmentType", v)}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full_time">{t("fullTime")}</SelectItem><SelectItem value="part_time">{t("partTime")}</SelectItem><SelectItem value="contract">{t("contract")}</SelectItem><SelectItem value="internship">{t("internship")}</SelectItem></SelectContent></Select></div>
                        <div><Label>{t("experience")}</Label><Input value={formData.experience} onChange={(e) => handleChange("experience", e.target.value)} className="mt-1.5" placeholder={t("experiencePlaceholder")} /></div>
                    </div>
                    <div><Label>{t("jobDescription")}</Label><Textarea value={formData.description} onChange={(e) => handleChange("description", e.target.value)} rows={4} className="mt-1.5" placeholder={t("jobDescriptionPlaceholder")} /></div>
                    <div><Label>{t("responsibilities")}</Label><Textarea value={formData.responsibilities} onChange={(e) => handleChange("responsibilities", e.target.value)} rows={3} className="mt-1.5" placeholder={t("responsibilitiesPlaceholder")} /></div>
                    <div><Label>{t("requirements")}</Label><Textarea value={formData.requirements} onChange={(e) => handleChange("requirements", e.target.value)} rows={3} className="mt-1.5" placeholder={t("requirementsPlaceholder")} /></div>
                    <div><Label>{t("skills")}</Label><Input value={formData.skills} onChange={(e) => handleChange("skills", e.target.value)} className="mt-1.5" placeholder={t("skillsPlaceholder")} /></div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-emerald-400" />{t("locationCompensation")}</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div><Label>{t("location")}</Label><Input value={formData.location} onChange={(e) => handleChange("location", e.target.value)} className="mt-1.5" placeholder={t("locationPlaceholder")} /></div>
                    <div className="flex items-center gap-3 pt-7"><Switch checked={formData.isRemote} onCheckedChange={(v) => handleChange("isRemote", v)} /><Label>{t("remotePosition")}</Label></div>
                    <div><Label>{t("minSalary")}</Label><Input type="number" value={formData.salaryMin} onChange={(e) => handleChange("salaryMin", e.target.value)} className="mt-1.5" placeholder={t("minSalaryPlaceholder")} /></div>
                    <div><Label>{t("maxSalary")}</Label><Input type="number" value={formData.salaryMax} onChange={(e) => handleChange("salaryMax", e.target.value)} className="mt-1.5" placeholder={t("maxSalaryPlaceholder")} /></div>
                    <div className="flex items-center gap-3"><Switch checked={formData.showSalary} onCheckedChange={(v) => handleChange("showSalary", v)} /><Label>{t("showSalary")}</Label></div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-purple-400" />{t("publishingSettings")}</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <div><Label>{t("openings")}</Label><Input type="number" min="1" value={formData.openings} onChange={(e) => handleChange("openings", e.target.value)} className="mt-1.5" /></div>
                    <div><Label>{t("deadline")}</Label><Input type="date" value={formData.closesAt} onChange={(e) => handleChange("closesAt", e.target.value)} className="mt-1.5" /></div>
                    <div><Label>{t("education")}</Label><Input value={formData.education} onChange={(e) => handleChange("education", e.target.value)} className="mt-1.5" /></div>
                </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={saving}><Save className="mr-2 h-4 w-4" />{t("saveAsDraft")}</Button>
                <Button variant="outline" onClick={() => handleSubmit("closed")} disabled={saving}>{t("closeJob")}</Button>
                <Button onClick={() => handleSubmit("open")} disabled={saving} className="bg-linear-to-r from-blue-500 to-indigo-600">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{t("publishChanges")}</Button>
            </div>
        </div>
    )
}
