"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Briefcase, Building2, Calendar, Edit, Loader2, MapPin, Trash2, UserPlus, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface Candidate {
    id: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
}

interface Application {
    id: string
    status: string
    appliedAt: string
    candidate: Candidate
}

interface JobPosting {
    id: string
    title: string
    description: string
    requirements?: string | null
    responsibilities?: string | null
    employmentType: string
    experience?: string | null
    education?: string | null
    skills?: string | null
    location?: string | null
    isRemote: boolean
    status: string
    openings: number
    salaryMin?: number | null
    salaryMax?: number | null
    showSalary: boolean
    postedAt?: string | null
    closesAt?: string | null
    createdAt: string
    department?: { id: string; name: string } | null
    designation?: { id: string; name: string } | null
    applications: Application[]
}

const statusClass: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-300",
    open: "bg-emerald-500/20 text-emerald-300",
    paused: "bg-amber-500/20 text-amber-300",
    closed: "bg-red-500/20 text-red-300",
}

function formatDate(value?: string | null) {
    if (!value) return "—"
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

function employmentTypeLabel(value: string) {
    return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function RecruitmentJobDetailPage() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const { addToast } = useToast()
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [job, setJob] = useState<JobPosting | null>(null)
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        const fetchJob = async () => {
            try {
                const res = await fetch(`/api/recruitment/jobs/${params.id}`)
                if (!res.ok) throw new Error("Failed to load job")
                setJob(await res.json())
            } catch {
                addToast({ title: "Could not load job", type: "error" })
            } finally {
                setLoading(false)
            }
        }
        fetchJob()
    }, [params.id, addToast])

    const handleDelete = async () => {
        if (!job) return; const _ok = await confirm({ title: `Delete job posting "${job.title}"?`, description: "This job posting and all applications will be permanently removed.", confirmLabel: "Delete", variant: "destructive" }); if (!_ok) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/recruitment/jobs/${job.id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Delete failed")
            addToast({ title: "Job deleted", type: "success" })
            router.push("/recruitment")
        } catch {
            addToast({ title: "Failed to delete job", type: "error" })
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>
    }

    if (!job) {
        return (
            <div className="space-y-4">
                <Link href="/recruitment"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" />Back to recruitment</Button></Link>
                <Card><CardContent className="py-12 text-center text-muted-foreground">Job posting not found.</CardContent></Card>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                    <Link href="/recruitment"><Button variant="ghost" className="px-0 text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" />Back to recruitment</Button></Link>
                    <div>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge className={statusClass[job.status] || "bg-muted text-muted-foreground"}>{job.status}</Badge>
                            <Badge variant="outline">{employmentTypeLabel(job.employmentType)}</Badge>
                            {job.isRemote && <Badge variant="outline">Remote</Badge>}
                        </div>
                        <h1 className="text-3xl font-display font-bold text-foreground">{job.title}</h1>
                        <p className="mt-2 text-muted-foreground">{job.department?.name || "No department"}{job.designation ? ` • ${job.designation.name}` : ""}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href={`/recruitment/jobs/${job.id}/edit`}><Button variant="outline"><Edit className="mr-2 h-4 w-4" />Edit</Button></Link>
                    <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete</Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card><CardContent className="p-5"><UserPlus className="mb-3 h-5 w-5 text-blue-400" /><p className="text-sm text-muted-foreground">Openings</p><p className="text-2xl font-display font-bold">{job.openings}</p></CardContent></Card>
                <Card><CardContent className="p-5"><Users className="mb-3 h-5 w-5 text-purple-400" /><p className="text-sm text-muted-foreground">Applications</p><p className="text-2xl font-display font-bold">{job.applications.length}</p></CardContent></Card>
                <Card><CardContent className="p-5"><Calendar className="mb-3 h-5 w-5 text-amber-400" /><p className="text-sm text-muted-foreground">Deadline</p><p className="text-lg font-semibold">{formatDate(job.closesAt)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><MapPin className="mb-3 h-5 w-5 text-emerald-400" /><p className="text-sm text-muted-foreground">Location</p><p className="text-lg font-semibold">{job.isRemote ? "Remote" : job.location || "—"}</p></CardContent></Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-blue-400" />Job details</CardTitle></CardHeader>
                        <CardContent className="space-y-6 text-sm leading-7 text-muted-foreground">
                            <section><h2 className="mb-2 font-semibold text-foreground">Description</h2><p className="whitespace-pre-wrap">{job.description}</p></section>
                            {job.responsibilities && <section><h2 className="mb-2 font-semibold text-foreground">Responsibilities</h2><p className="whitespace-pre-wrap">{job.responsibilities}</p></section>}
                            {job.requirements && <section><h2 className="mb-2 font-semibold text-foreground">Requirements</h2><p className="whitespace-pre-wrap">{job.requirements}</p></section>}
                            {job.skills && <section><h2 className="mb-2 font-semibold text-foreground">Skills</h2><p>{job.skills}</p></section>}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Department</span><span className="text-right font-medium">{job.department?.name || "—"}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Designation</span><span className="text-right font-medium">{job.designation?.name || "—"}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Experience</span><span className="text-right font-medium">{job.experience || "—"}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Education</span><span className="text-right font-medium">{job.education || "—"}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Posted</span><span className="text-right font-medium">{formatDate(job.postedAt || job.createdAt)}</span></div>
                            {job.showSalary && (job.salaryMin || job.salaryMax) && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Salary</span><span className="text-right font-medium">৳{job.salaryMin?.toLocaleString() || 0}{job.salaryMax ? ` - ৳${job.salaryMax.toLocaleString()}` : ""}</span></div>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-indigo-400" />Applications</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {job.applications.length === 0 ? <p className="text-sm text-muted-foreground">No applications yet.</p> : job.applications.map((application) => (
                                <div key={application.id} className="rounded-lg border border-card-border p-3">
                                    <div className="font-medium">{application.candidate.firstName} {application.candidate.lastName}</div>
                                    <div className="text-xs text-muted-foreground">{application.candidate.email}</div>
                                    <div className="mt-2 flex items-center justify-between text-xs"><Badge variant="outline">{application.status}</Badge><span>{formatDate(application.appliedAt)}</span></div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
