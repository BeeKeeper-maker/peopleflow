"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ArrowLeft,
    Briefcase,
    MapPin,
    DollarSign,
    Calendar,
    Users,
    Save,
    Send,
    Loader2,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { useTranslations } from "next-intl"

interface Department {
    id: string
    name: string
}

interface Designation {
    id: string
    name: string
}

export default function NewJobPage() {
    const router = useRouter()
    const { addToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [departments, setDepartments] = useState<Department[]>([])
    const [designations, setDesignations] = useState<Designation[]>([])
    const t = useTranslations("FormRecruitmentJobs")

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
        fetchDepartments()
        fetchDesignations()
    }, [])

    const fetchDepartments = async () => {
        try {
            const res = await fetch("/api/departments")
            if (res.ok) setDepartments(await res.json())
        } catch (e) {
            console.error(e)
        }
    }

    const fetchDesignations = async () => {
        try {
            const res = await fetch("/api/designations")
            if (res.ok) setDesignations(await res.json())
        } catch (e) {
            console.error(e)
        }
    }

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (asDraft: boolean) => {
        if (!formData.title || !formData.description || !formData.employmentType) {
            addToast({
                title: t("error"),
                description: t("requiredFields"),
                type: "error",
            })
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/recruitment/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    salaryMin: formData.salaryMin ? parseFloat(formData.salaryMin) : null,
                    salaryMax: formData.salaryMax ? parseFloat(formData.salaryMax) : null,
                    openings: parseInt(formData.openings) || 1,
                    status: asDraft ? "draft" : "open",
                    departmentId: formData.departmentId || null,
                    designationId: formData.designationId || null,
                }),
            })

            if (res.ok) {
                addToast({
                    title: t("success"),
                    description: asDraft ? t("draftSuccess") : t("postSuccess"),
                    type: "success",
                })
                router.push("/recruitment")
            } else {
                throw new Error(t("createFailed"))
            }
        } catch (error) {
            addToast({
                title: t("error"),
                description: t("createFailed"),
                type: "error",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/recruitment">
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
                {/* Basic Info */}
                <Card className="bg-card border-card-border">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-blue-400" />
                            {t("jobDetails")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label className="text-foreground">{t("jobTitle")}</Label>
                                <Input
                                    value={formData.title}
                                    onChange={(e) => handleChange("title", e.target.value)}
                                    placeholder={t("jobTitlePlaceholder")}
                                    className="mt-1.5 bg-hover border-card-border"
                                />
                            </div>

                            <div>
                                <Label className="text-foreground">{t("department")}</Label>
                                <Select
                                    value={formData.departmentId}
                                    onValueChange={(v) => handleChange("departmentId", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-hover border-card-border">
                                        <SelectValue placeholder={t("selectDepartment")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((d) => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-foreground">{t("designation")}</Label>
                                <Select
                                    value={formData.designationId}
                                    onValueChange={(v) => handleChange("designationId", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-hover border-card-border">
                                        <SelectValue placeholder={t("selectDesignation")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {designations.map((d) => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-foreground">{t("employmentType")}</Label>
                                <Select
                                    value={formData.employmentType}
                                    onValueChange={(v) => handleChange("employmentType", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-hover border-card-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="full_time">{t("fullTime")}</SelectItem>
                                        <SelectItem value="part_time">{t("partTime")}</SelectItem>
                                        <SelectItem value="contract">{t("contract")}</SelectItem>
                                        <SelectItem value="internship">{t("internship")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-foreground">{t("experience")}</Label>
                                <Select
                                    value={formData.experience}
                                    onValueChange={(v) => handleChange("experience", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-hover border-card-border">
                                        <SelectValue placeholder={t("selectExperience")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0-1">{t("fresher")}</SelectItem>
                                        <SelectItem value="1-3">{t("junior")}</SelectItem>
                                        <SelectItem value="3-5">{t("midLevel")}</SelectItem>
                                        <SelectItem value="5-10">{t("senior")}</SelectItem>
                                        <SelectItem value="10+">{t("expert")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label className="text-foreground">{t("jobDescription")}</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => handleChange("description", e.target.value)}
                                placeholder={t("jobDescriptionPlaceholder")}
                                rows={4}
                                className="mt-1.5 bg-hover border-card-border"
                            />
                        </div>

                        <div>
                            <Label className="text-foreground">{t("requirements")}</Label>
                            <Textarea
                                value={formData.requirements}
                                onChange={(e) => handleChange("requirements", e.target.value)}
                                placeholder={t("requirementsPlaceholder")}
                                rows={3}
                                className="mt-1.5 bg-hover border-card-border"
                            />
                        </div>

                        <div>
                            <Label className="text-foreground">{t("skills")}</Label>
                            <Input
                                value={formData.skills}
                                onChange={(e) => handleChange("skills", e.target.value)}
                                placeholder={t("skillsPlaceholder")}
                                className="mt-1.5 bg-hover border-card-border"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Location & Salary */}
                <Card className="bg-card border-card-border">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-green-400" />
                            {t("locationCompensation")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-foreground">{t("location")}</Label>
                                <Input
                                    value={formData.location}
                                    onChange={(e) => handleChange("location", e.target.value)}
                                    placeholder={t("locationPlaceholder")}
                                    className="mt-1.5 bg-hover border-card-border"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-6">
                                <Switch
                                    checked={formData.isRemote}
                                    onCheckedChange={(v) => handleChange("isRemote", v)}
                                />
                                <Label className="text-foreground">{t("remotePosition")}</Label>
                            </div>

                            <div>
                                <Label className="text-foreground">{t("minSalary")}</Label>
                                <Input
                                    type="number"
                                    value={formData.salaryMin}
                                    onChange={(e) => handleChange("salaryMin", e.target.value)}
                                    placeholder="e.g. 50000"
                                    className="mt-1.5 bg-hover border-card-border"
                                />
                            </div>

                            <div>
                                <Label className="text-foreground">{t("maxSalary")}</Label>
                                <Input
                                    type="number"
                                    value={formData.salaryMax}
                                    onChange={(e) => handleChange("salaryMax", e.target.value)}
                                    placeholder="e.g. 80000"
                                    className="mt-1.5 bg-hover border-card-border"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <Switch
                                    checked={formData.showSalary}
                                    onCheckedChange={(v) => handleChange("showSalary", v)}
                                />
                                <Label className="text-foreground">{t("showSalary")}</Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Additional Settings */}
                <Card className="bg-card border-card-border">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-purple-400" />
                            {t("additionalSettings")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-foreground">{t("openings")}</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.openings}
                                    onChange={(e) => handleChange("openings", e.target.value)}
                                    className="mt-1.5 bg-hover border-card-border"
                                />
                            </div>

                            <div>
                                <Label className="text-foreground">{t("deadline")}</Label>
                                <Input
                                    type="date"
                                    value={formData.closesAt}
                                    onChange={(e) => handleChange("closesAt", e.target.value)}
                                    className="mt-1.5 bg-hover border-card-border"
                                />
                            </div>

                            <div>
                                <Label className="text-foreground">{t("education")}</Label>
                                <Select
                                    value={formData.education}
                                    onValueChange={(v) => handleChange("education", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-hover border-card-border">
                                        <SelectValue placeholder={t("selectEducation")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">{t("eduAny")}</SelectItem>
                                        <SelectItem value="high_school">{t("eduHighSchool")}</SelectItem>
                                        <SelectItem value="diploma">{t("eduDiploma")}</SelectItem>
                                        <SelectItem value="bachelors">{t("eduBachelors")}</SelectItem>
                                        <SelectItem value="masters">{t("eduMasters")}</SelectItem>
                                        <SelectItem value="phd">{t("eduPhd")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex items-center gap-4 pt-4">
                    <Button
                        variant="outline"
                        onClick={() => handleSubmit(true)}
                        disabled={loading}
                        className="border-card-border"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {t("saveAsDraft")}
                    </Button>
                    <Button
                        onClick={() => handleSubmit(false)}
                        disabled={loading}
                        className="bg-linear-to-r from-blue-500 to-indigo-600"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4 mr-2" />
                        )}
                        {t("postJob")}
                    </Button>
                </div>
            </div>
        </div>
    )
}
