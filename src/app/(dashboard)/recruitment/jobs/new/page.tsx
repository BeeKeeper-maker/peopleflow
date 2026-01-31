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
                title: "Error",
                description: "Please fill in all required fields",
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
                    title: "Success",
                    description: asDraft ? "Job saved as draft" : "Job posted successfully",
                    type: "success",
                })
                router.push("/recruitment")
            } else {
                throw new Error("Failed to create job")
            }
        } catch (error) {
            addToast({
                title: "Error",
                description: "Failed to create job posting",
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
                    <Button variant="ghost" size="icon" className="text-white/60">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Post New Job</h1>
                    <p className="text-white/60 mt-1">Create a new job posting</p>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
                {/* Basic Info */}
                <Card className="bg-[#12121A] border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-blue-400" />
                            Job Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label className="text-white/80">Job Title *</Label>
                                <Input
                                    value={formData.title}
                                    onChange={(e) => handleChange("title", e.target.value)}
                                    placeholder="e.g. Senior Software Engineer"
                                    className="mt-1.5 bg-white/5 border-white/10"
                                />
                            </div>

                            <div>
                                <Label className="text-white/80">Department</Label>
                                <Select
                                    value={formData.departmentId}
                                    onValueChange={(v) => handleChange("departmentId", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-white/5 border-white/10">
                                        <SelectValue placeholder="Select department" />
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
                                <Label className="text-white/80">Designation</Label>
                                <Select
                                    value={formData.designationId}
                                    onValueChange={(v) => handleChange("designationId", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-white/5 border-white/10">
                                        <SelectValue placeholder="Select designation" />
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
                                <Label className="text-white/80">Employment Type *</Label>
                                <Select
                                    value={formData.employmentType}
                                    onValueChange={(v) => handleChange("employmentType", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-white/5 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="full_time">Full Time</SelectItem>
                                        <SelectItem value="part_time">Part Time</SelectItem>
                                        <SelectItem value="contract">Contract</SelectItem>
                                        <SelectItem value="internship">Internship</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-white/80">Experience</Label>
                                <Select
                                    value={formData.experience}
                                    onValueChange={(v) => handleChange("experience", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-white/5 border-white/10">
                                        <SelectValue placeholder="Select experience level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0-1">Fresher (0-1 years)</SelectItem>
                                        <SelectItem value="1-3">Junior (1-3 years)</SelectItem>
                                        <SelectItem value="3-5">Mid-level (3-5 years)</SelectItem>
                                        <SelectItem value="5-10">Senior (5-10 years)</SelectItem>
                                        <SelectItem value="10+">Expert (10+ years)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label className="text-white/80">Job Description *</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => handleChange("description", e.target.value)}
                                placeholder="Describe the role and responsibilities..."
                                rows={4}
                                className="mt-1.5 bg-white/5 border-white/10"
                            />
                        </div>

                        <div>
                            <Label className="text-white/80">Requirements</Label>
                            <Textarea
                                value={formData.requirements}
                                onChange={(e) => handleChange("requirements", e.target.value)}
                                placeholder="List the requirements for this position..."
                                rows={3}
                                className="mt-1.5 bg-white/5 border-white/10"
                            />
                        </div>

                        <div>
                            <Label className="text-white/80">Skills (comma-separated)</Label>
                            <Input
                                value={formData.skills}
                                onChange={(e) => handleChange("skills", e.target.value)}
                                placeholder="e.g. React, Node.js, TypeScript"
                                className="mt-1.5 bg-white/5 border-white/10"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Location & Salary */}
                <Card className="bg-[#12121A] border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-green-400" />
                            Location & Compensation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-white/80">Location</Label>
                                <Input
                                    value={formData.location}
                                    onChange={(e) => handleChange("location", e.target.value)}
                                    placeholder="e.g. Dhaka, Bangladesh"
                                    className="mt-1.5 bg-white/5 border-white/10"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-6">
                                <Switch
                                    checked={formData.isRemote}
                                    onCheckedChange={(v) => handleChange("isRemote", v)}
                                />
                                <Label className="text-white/80">Remote Position</Label>
                            </div>

                            <div>
                                <Label className="text-white/80">Minimum Salary (BDT)</Label>
                                <Input
                                    type="number"
                                    value={formData.salaryMin}
                                    onChange={(e) => handleChange("salaryMin", e.target.value)}
                                    placeholder="e.g. 50000"
                                    className="mt-1.5 bg-white/5 border-white/10"
                                />
                            </div>

                            <div>
                                <Label className="text-white/80">Maximum Salary (BDT)</Label>
                                <Input
                                    type="number"
                                    value={formData.salaryMax}
                                    onChange={(e) => handleChange("salaryMax", e.target.value)}
                                    placeholder="e.g. 80000"
                                    className="mt-1.5 bg-white/5 border-white/10"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <Switch
                                    checked={formData.showSalary}
                                    onCheckedChange={(v) => handleChange("showSalary", v)}
                                />
                                <Label className="text-white/80">Show salary in job posting</Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Additional Settings */}
                <Card className="bg-[#12121A] border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-purple-400" />
                            Additional Settings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-white/80">Number of Openings</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.openings}
                                    onChange={(e) => handleChange("openings", e.target.value)}
                                    className="mt-1.5 bg-white/5 border-white/10"
                                />
                            </div>

                            <div>
                                <Label className="text-white/80">Application Deadline</Label>
                                <Input
                                    type="date"
                                    value={formData.closesAt}
                                    onChange={(e) => handleChange("closesAt", e.target.value)}
                                    className="mt-1.5 bg-white/5 border-white/10"
                                />
                            </div>

                            <div>
                                <Label className="text-white/80">Education</Label>
                                <Select
                                    value={formData.education}
                                    onValueChange={(v) => handleChange("education", v)}
                                >
                                    <SelectTrigger className="mt-1.5 bg-white/5 border-white/10">
                                        <SelectValue placeholder="Select education level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Any</SelectItem>
                                        <SelectItem value="high_school">High School</SelectItem>
                                        <SelectItem value="diploma">Diploma</SelectItem>
                                        <SelectItem value="bachelors">Bachelor's Degree</SelectItem>
                                        <SelectItem value="masters">Master's Degree</SelectItem>
                                        <SelectItem value="phd">PhD</SelectItem>
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
                        className="border-white/10"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Save as Draft
                    </Button>
                    <Button
                        onClick={() => handleSubmit(false)}
                        disabled={loading}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4 mr-2" />
                        )}
                        Post Job
                    </Button>
                </div>
            </div>
        </div>
    )
}
