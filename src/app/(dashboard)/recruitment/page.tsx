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

    useEffect(() => {
        fetchJobs()
    }, [])

    const fetchJobs = async () => {
        try {
            const res = await fetch("/api/recruitment/jobs")
            if (res.ok) {
                setJobs(await res.json())
            }
        } catch (error) {
            console.error("Failed to fetch jobs", error)
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
                    <h1 className="text-3xl font-bold text-white">Recruitment</h1>
                    <p className="text-white/60 mt-1">Manage job postings and candidates</p>
                </div>
                <Link href="/recruitment/jobs/new">
                    <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90">
                        <Plus className="h-4 w-4 mr-2" />
                        Post New Job
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-[#12121A] border-white/10">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-white/60">Total Jobs</p>
                                <h3 className="text-2xl font-bold text-white">{stats.total}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600">
                                <Briefcase className="h-5 w-5 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#12121A] border-white/10">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-white/60">Open Positions</p>
                                <h3 className="text-2xl font-bold text-white">{stats.open}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600">
                                <CheckCircle2 className="h-5 w-5 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#12121A] border-white/10">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-white/60">Total Applications</p>
                                <h3 className="text-2xl font-bold text-white">{stats.totalApplications}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600">
                                <Users className="h-5 w-5 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#12121A] border-white/10">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-white/60">Total Openings</p>
                                <h3 className="text-2xl font-bold text-white">{stats.positions}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600">
                                <UserPlus className="h-5 w-5 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-white/5 border-white/10">
                    <TabsTrigger value="all">All Jobs ({jobs.length})</TabsTrigger>
                    <TabsTrigger value="open">Open ({stats.open})</TabsTrigger>
                    <TabsTrigger value="draft">Draft ({jobs.filter(j => j.status === "draft").length})</TabsTrigger>
                    <TabsTrigger value="closed">Closed ({jobs.filter(j => j.status === "closed").length})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
                        </div>
                    ) : filteredJobs.length === 0 ? (
                        <Card className="bg-[#12121A] border-white/10">
                            <CardContent className="py-16 text-center">
                                <Briefcase className="h-12 w-12 mx-auto text-white/20 mb-4" />
                                <h3 className="text-lg font-medium text-white mb-2">
                                    No job postings yet
                                </h3>
                                <p className="text-white/40 mb-6">
                                    Create your first job posting to start hiring
                                </p>
                                <Link href="/recruitment/jobs/new">
                                    <Button className="bg-gradient-to-r from-blue-500 to-indigo-600">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Post New Job
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
    return (
        <Card className="bg-[#12121A] border-white/10 hover:border-white/20 transition-all group">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className={statusColors[job.status]}>
                                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                            </Badge>
                            <Badge variant="outline" className="border-white/20">
                                {employmentTypeLabels[job.employmentType] || job.employmentType}
                            </Badge>
                        </div>

                        <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                            {job.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-white/60 mt-2">
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

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                    <Link href={`/recruitment/jobs/${job.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full border-white/10">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                        </Button>
                    </Link>
                    <Link href={`/recruitment/jobs/${job.id}/edit`}>
                        <Button variant="ghost" size="sm" className="text-white/60">
                            <Edit className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    )
}
