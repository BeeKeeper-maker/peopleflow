"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Briefcase,
    MapPin,
    DollarSign,
    Calendar,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    Upload,
    Building2,
    Users,
    Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface JobDetail {
    id: string;
    title: string;
    description: string;
    requirements?: string;
    responsibilities?: string;
    employmentType: string;
    experience?: string;
    education?: string;
    skills?: string;
    salaryMin?: number;
    salaryMax?: number;
    currency: string;
    showSalary: boolean;
    location?: string;
    isRemote: boolean;
    openings: number;
    postedAt?: string;
    closesAt?: string;
    department?: { name: string };
    designation?: { name: string };
}

interface Company {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    industry?: string;
}

export default function JobDetailPage({ params }: { params: Promise<{ orgSlug: string; jobId: string }> }) {
    const router = useRouter();
    const { addToast } = useToast();
    const [company, setCompany] = useState<Company | null>(null);
    const [job, setJob] = useState<JobDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showApplyForm, setShowApplyForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        yearsOfExp: "",
        currentCompany: "",
        currentTitle: "",
        skills: "",
        coverLetter: "",
        resume: null as File | null,
        linkedinUrl: "",
        portfolioUrl: "",
    });

    useEffect(() => {
        params.then((p) => {
            fetchJob(p.orgSlug, p.jobId);
        });
    }, [params]);

    const fetchJob = async (orgSlug: string, jobId: string) => {
        try {
            const res = await fetch(`/api/public/careers/${orgSlug}/jobs/${jobId}`);
            if (res.ok) {
                const data = await res.json();
                setCompany(data.company);
                setJob(data.job);
            } else if (res.status === 404) {
                setJob(null);
            }
        } catch {
            setJob(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (orgSlug: string, jobId: string) => {
        if (!formData.firstName || !formData.lastName || !formData.email) {
            addToast({ title: "Please fill in all required fields", type: "error" });
            return;
        }

        setSubmitting(true);

        let resumeUrl: string | undefined;
        if (formData.resume) {
            // For public apply, we can't use the authenticated upload endpoint.
            // The resume will be sent as base64 or we skip it for now.
            // In production, this would use a public upload endpoint.
            addToast({ title: "Resume upload not available for public applications. Please provide a LinkedIn/portfolio URL.", type: "info" });
        }

        try {
            const res = await fetch(`/api/public/careers/${orgSlug}/jobs/${jobId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone || undefined,
                    yearsOfExp: formData.yearsOfExp ? Number(formData.yearsOfExp) : undefined,
                    currentCompany: formData.currentCompany || undefined,
                    currentTitle: formData.currentTitle || undefined,
                    skills: formData.skills || undefined,
                    coverLetter: formData.coverLetter || undefined,
                    linkedinUrl: formData.linkedinUrl || undefined,
                    portfolioUrl: formData.portfolioUrl || undefined,
                    source: "website",
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setSuccess(true);
                addToast({ title: data.message || "Application submitted!", type: "success" });
            } else {
                const err = await res.json().catch(() => ({}));
                addToast({ title: err.error || "Failed to submit application", type: "error" });
            }
        } catch {
            addToast({ title: "Network error. Please try again.", type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!job) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <Briefcase className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">Job not found</p>
                <p className="text-sm text-muted-foreground">This position may have been closed or removed.</p>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go Back
                </Button>
            </div>
        );
    }

    const employmentTypeLabels: Record<string, string> = {
        full_time: "Full Time",
        part_time: "Part Time",
        contract: "Contract",
        internship: "Internship",
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-card-border bg-card">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.push(`/careers/${company?.slug || ""}`)}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                        {company?.logoUrl ? (
                            <img src={company.logoUrl} alt={company.name} className="w-10 h-10 rounded-lg" />
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-blue-400" />
                            </div>
                        )}
                        <div className="text-left">
                            <p className="font-bold text-foreground">{company?.name || "Company"}</p>
                            <p className="text-xs text-muted-foreground">{company?.industry || "Careers"}</p>
                        </div>
                    </button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/careers/${company?.slug || ""}`)}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        All Jobs
                    </Button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                {/* Success state */}
                {success ? (
                    <Card className="bg-card border-card-border">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-8 w-8 text-green-400" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground">Application Submitted!</h2>
                            <p className="text-muted-foreground mt-2 text-center max-w-md">
                                Thank you for applying for {job.title} at {company?.name}. We&apos;ve received your application and will contact you soon.
                            </p>
                            <Button
                                className="mt-6 bg-blue-600 hover:bg-blue-700"
                                onClick={() => router.push(`/careers/${company?.slug || ""}`)}
                            >
                                Browse More Jobs
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Job Header */}
                        <div className="space-y-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                    <h1 className="text-3xl font-bold text-foreground">{job.title}</h1>
                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                                        {job.department && (
                                            <span className="flex items-center gap-1">
                                                <Briefcase className="h-4 w-4" />
                                                {job.department.name}
                                            </span>
                                        )}
                                        {job.location && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-4 w-4" />
                                                {job.location}
                                                {job.isRemote && " (Remote)"}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            {employmentTypeLabels[job.employmentType] || job.employmentType}
                                        </span>
                                        {job.openings > 1 && (
                                            <span className="flex items-center gap-1">
                                                <Users className="h-4 w-4" />
                                                {job.openings} openings
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    size="lg"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => setShowApplyForm(!showApplyForm)}
                                >
                                    Apply Now
                                </Button>
                            </div>

                            {/* Salary + Posted Date */}
                            <div className="flex flex-wrap gap-4">
                                {job.showSalary && job.salaryMin && job.salaryMax && (
                                    <Badge variant="outline" className="text-green-400 border-green-400/30 text-sm py-1 px-3">
                                        <DollarSign className="h-3 w-3 mr-1" />
                                        {job.currency} {job.salaryMin.toLocaleString()} - {job.salaryMax.toLocaleString()}
                                    </Badge>
                                )}
                                {job.postedAt && (
                                    <Badge variant="outline" className="text-muted-foreground text-sm py-1 px-3">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        Posted {new Date(job.postedAt).toLocaleDateString()}
                                    </Badge>
                                )}
                                {job.experience && (
                                    <Badge variant="outline" className="text-muted-foreground text-sm py-1 px-3">
                                        {job.experience} experience
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Job Description */}
                        <Card className="bg-card border-card-border">
                            <CardHeader>
                                <CardTitle className="text-lg">Job Description</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
                            </CardContent>
                        </Card>

                        {/* Requirements */}
                        {job.requirements && (
                            <Card className="bg-card border-card-border">
                                <CardHeader>
                                    <CardTitle className="text-lg">Requirements</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Responsibilities */}
                        {job.responsibilities && (
                            <Card className="bg-card border-card-border">
                                <CardHeader>
                                    <CardTitle className="text-lg">Responsibilities</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.responsibilities}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Skills */}
                        {job.skills && (
                            <Card className="bg-card border-card-border">
                                <CardHeader>
                                    <CardTitle className="text-lg">Required Skills</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {job.skills.split(",").map((skill, i) => (
                                            <Badge key={i} variant="secondary" className="text-sm">
                                                {skill.trim()}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Apply Form */}
                        {showApplyForm && (
                            <Card className="bg-card border-card-border border-blue-500/30">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-blue-400" />
                                        Apply for {job.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground">First Name *</Label>
                                            <Input
                                                value={formData.firstName}
                                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                className="bg-background border-card-border"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground">Last Name *</Label>
                                            <Input
                                                value={formData.lastName}
                                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                className="bg-background border-card-border"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground">Email *</Label>
                                            <Input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="bg-background border-card-border"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground">Phone</Label>
                                            <Input
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="bg-background border-card-border"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground">Years of Experience</Label>
                                            <Input
                                                type="number"
                                                value={formData.yearsOfExp}
                                                onChange={(e) => setFormData({ ...formData, yearsOfExp: e.target.value })}
                                                className="bg-background border-card-border"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground">Current Title</Label>
                                            <Input
                                                value={formData.currentTitle}
                                                onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
                                                className="bg-background border-card-border"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">LinkedIn URL</Label>
                                        <Input
                                            type="url"
                                            placeholder="https://linkedin.com/in/yourprofile"
                                            value={formData.linkedinUrl}
                                            onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                                            className="bg-background border-card-border"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">Portfolio URL</Label>
                                        <Input
                                            type="url"
                                            placeholder="https://yourportfolio.com"
                                            value={formData.portfolioUrl}
                                            onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                                            className="bg-background border-card-border"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">Skills (comma-separated)</Label>
                                        <Input
                                            value={formData.skills}
                                            onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                                            placeholder="JavaScript, React, Node.js, PostgreSQL"
                                            className="bg-background border-card-border"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">Cover Letter</Label>
                                        <Textarea
                                            value={formData.coverLetter}
                                            onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                                            rows={4}
                                            placeholder="Tell us why you're a great fit for this role..."
                                            className="bg-background border-card-border"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-3 pt-2">
                                        <Button variant="ghost" onClick={() => setShowApplyForm(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={() => params.then((p) => handleSubmit(p.orgSlug, p.jobId))}
                                            disabled={submitting}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                            {submitting ? "Submitting..." : "Submit Application"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
