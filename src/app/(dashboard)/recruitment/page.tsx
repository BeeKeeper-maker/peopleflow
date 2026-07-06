"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Briefcase,
    Users,
    UserPlus,
    Calendar,
    MapPin,
    Clock,
    Building2,
    Plus,
    Eye,
    Edit,
    MoreVertical,
    TrendingUp,
    CheckCircle2,
    XCircle,
    Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

interface JobPosting {
    id: string
    title: string
    description: string
    employmentType: string
    experience?: string
    location?: string
    isRemote: boolean
    status: string
    openings: number
    salaryMin?: number
    salaryMax?: number
    showSalary: boolean
    postedAt?: string
    closesAt?: string
    createdAt: string
    department?: { id: string; name: string }
    designation?: { id: string; name: string }
    _count: { applications: number }
}

const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    open: "bg-green-500/20 text-green-400",
    paused: "bg-amber-500/20 text-amber-400",
    closed: "bg-red-500/20 text-red-400",
}

const employmentTypeLabels: Record<string, string> = {
    full_time: "Full Time",
    part_time: "Part Time",
    contract: "Contract",
    internship: "Internship",
}

export default function RecruitmentPage() {
    const { addToast } = useToast()
    const [jobs, setJobs] = useState<JobPosting[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("all")
    const t = useTranslations('Recruitment')

    useEffect(() => {
        fetchJobs()
    }, [])

    const fetchJobs = async () => {
        try {
            const res = await fetch("/api/recruitment/jobs")
            if (res.ok) {
                const response = await res.json()
                // Handle both wrapped and raw responses
                setJobs(response.data || response || [])
            }
        } catch (error) {
            console.error("Failed to fetch data:", error); addToast({ title: "Failed to load data. Please refresh.", type: "error" })
        } finally {
            setLoading(false)
        }
    }

    const stats = {
        total: jobs.length,
        open: jobs.filter(j => j.status === "open").length,
        totalApplications: jobs.reduce((sum, j) => sum + j._count.applications, 0),
        positions: jobs.reduce((sum, j) => sum + j.openings, 0),
    }

    const filteredJobs = activeTab === "all"
        ? jobs
        : jobs.filter(j => j.status === activeTab)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-foreground">{t('title')}</h1>
                    <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                </div>
                <Link href="/recruitment/jobs/new">
                    <Button className="bg-linear-to-r from-blue-500 to-indigo-600 hover:opacity-90">
                        <Plus className="h-4 w-4 mr-2" />
                        {t('postJob')}
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-card border-card-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('totalJobs')}</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{stats.total}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-linear-to-r from-blue-500 to-indigo-600">
                                <Briefcase className="h-5 w-5 text-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-card-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('openPositions')}</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{stats.open}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-linear-to-r from-green-500 to-emerald-600">
                                <CheckCircle2 className="h-5 w-5 text-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-card-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('totalApplications')}</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{stats.totalApplications}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-linear-to-r from-purple-500 to-pink-600">
                                <Users className="h-5 w-5 text-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-card-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('totalOpenings')}</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{stats.positions}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-linear-to-r from-amber-500 to-orange-600">
                                <UserPlus className="h-5 w-5 text-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-hover border-card-border">
                    <TabsTrigger value="all">{t('allJobs')} ({jobs.length})</TabsTrigger>
                    <TabsTrigger value="open">{t('openTab')} ({stats.open})</TabsTrigger>
                    <TabsTrigger value="draft">{t('draftTab')} ({jobs.filter(j => j.status === "draft").length})</TabsTrigger>
                    <TabsTrigger value="closed">{t('closedTab')} ({jobs.filter(j => j.status === "closed").length})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-tertiary-foreground" />
                        </div>
                    ) : filteredJobs.length === 0 ? (
                        <Card className="bg-card border-card-border">
                            <CardContent className="py-16 text-center">
                                <Briefcase className="h-12 w-12 mx-auto text-muted-text mb-4" />
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    {t('noJobs')}
                                </h3>
                                <p className="text-tertiary-foreground mb-6">
                                    {t('noJobsDesc')}
                                </p>
                                <Link href="/recruitment/jobs/new">
                                    <Button className="bg-linear-to-r from-blue-500 to-indigo-600">
                                        <Plus className="h-4 w-4 mr-2" />
                                        {t('postJob')}
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredJobs.map((job) => (
                                <JobCard key={job.id} job={job} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

function JobCard({ job }: { job: JobPosting }) {
    const t = useTranslations('Recruitment')
    return (
        <Card className="bg-card border-card-border hover:border-border-hover transition-all group">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className={statusColors[job.status]}>
                                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                            </Badge>
                            <Badge variant="outline" className="border-border-hover">
                                {employmentTypeLabels[job.employmentType] || job.employmentType}
                            </Badge>
                        </div>

                        <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-blue-400 transition-colors">
                            {job.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                            {job.department && (
                                <span className="flex items-center gap-1">
                                    <Building2 className="h-3.5 w-3.5" />
                                    {job.department.name}
                                </span>
                            )}
                            {(job.location || job.isRemote) && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {job.isRemote ? "Remote" : job.location}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {job._count.applications} applicants
                            </span>
                            <span className="flex items-center gap-1">
                                <UserPlus className="h-3.5 w-3.5" />
                                {job.openings} openings
                            </span>
                        </div>

                        {job.showSalary && job.salaryMin && (
                            <p className="text-sm text-emerald-400 mt-2">
                                ৳{job.salaryMin.toLocaleString()}
                                {job.salaryMax && ` - ৳${job.salaryMax.toLocaleString()}`}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-card-border">
                    <Link href={`/recruitment/jobs/${job.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full border-card-border">
                            <Eye className="h-4 w-4 mr-2" />
                            {t('viewDetails')}
                        </Button>
                    </Link>
                    <Link href={`/recruitment/jobs/${job.id}/edit`}>
                        <Button variant="ghost" size="sm" className="text-muted-foreground">
                            <Edit className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    )
}
