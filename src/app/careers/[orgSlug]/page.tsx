"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Briefcase,
    MapPin,
    DollarSign,
    Calendar,
    Clock,
    Users,
    Building2,
    Loader2,
    ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Job {
    id: string;
    title: string;
    description: string;
    employmentType: string;
    experience?: string;
    location?: string;
    isRemote: boolean;
    salaryMin?: number | null;
    salaryMax?: number | null;
    currency: string;
    showSalary: boolean;
    openings: number;
    postedAt?: string;
    closesAt?: string;
    department?: string;
    designation?: string;
}

interface Company {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    industry?: string;
}

const employmentTypeLabels: Record<string, string> = {
    full_time: "Full Time",
    part_time: "Part Time",
    contract: "Contract",
    internship: "Internship",
};

export default function CareersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
    const router = useRouter();
    const [company, setCompany] = useState<Company | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [orgSlug, setOrgSlug] = useState("");

    useEffect(() => {
        params.then((p) => {
            setOrgSlug(p.orgSlug);
            fetchJobs(p.orgSlug);
        });
    }, [params]);

    const fetchJobs = async (slug: string) => {
        try {
            const res = await fetch(`/api/public/careers/${slug}/jobs`);
            if (res.ok) {
                const data = await res.json();
                setCompany(data.company);
                setJobs(data.jobs || []);
            } else if (res.status === 404) {
                setCompany(null);
            }
        } catch {
            setCompany(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!company) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <Building2 className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">Company not found</p>
                <p className="text-sm text-muted-foreground">The company you&apos;re looking for doesn&apos;t exist or doesn&apos;t have a public career page.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Header */}
            <header className="border-b border-card-border bg-gradient-to-b from-card to-background">
                <div className="max-w-4xl mx-auto px-4 py-12 text-center">
                    {company.logoUrl ? (
                        <img src={company.logoUrl} alt={company.name} className="w-20 h-20 rounded-2xl mx-auto mb-4" />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-blue-600/20 flex items-center justify-center mx-auto mb-4">
                            <Building2 className="h-10 w-10 text-blue-400" />
                        </div>
                    )}
                    <h1 className="text-3xl font-bold text-foreground">{company.name}</h1>
                    <p className="text-muted-foreground mt-2">
                        {company.industry ? `${company.industry} · ` : ""}
                        {jobs.length} open position{jobs.length !== 1 ? "s" : ""}
                    </p>
                </div>
            </header>

            {/* Jobs List */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                {jobs.length === 0 ? (
                    <Card className="bg-card border-card-border">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-lg font-medium text-foreground">No open positions right now</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Please check back later or follow {company.name} for updates.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {jobs.map((job) => (
                            <Link key={job.id} href={`/careers/${orgSlug}/jobs/${job.id}`}>
                                <Card className="bg-card border-card-border hover:border-blue-500/30 transition-colors cursor-pointer group">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-foreground group-hover:text-blue-400 transition-colors">
                                                    {job.title}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                                                    {job.department && (
                                                        <span className="flex items-center gap-1">
                                                            <Briefcase className="h-3.5 w-3.5" />
                                                            {job.department}
                                                        </span>
                                                    )}
                                                    {job.location && (
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="h-3.5 w-3.5" />
                                                            {job.location}
                                                            {job.isRemote && " (Remote)"}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {employmentTypeLabels[job.employmentType] || job.employmentType}
                                                    </span>
                                                    {job.openings > 1 && (
                                                        <span className="flex items-center gap-1">
                                                            <Users className="h-3.5 w-3.5" />
                                                            {job.openings} openings
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                                                    {job.description}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 shrink-0">
                                                {job.showSalary && job.salaryMin && job.salaryMax && (
                                                    <Badge variant="outline" className="text-green-400 border-green-400/30">
                                                        <DollarSign className="h-3 w-3 mr-1" />
                                                        {job.currency} {job.salaryMin.toLocaleString()} - {job.salaryMax.toLocaleString()}
                                                    </Badge>
                                                )}
                                                {job.postedAt && (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        <Calendar className="h-3 w-3 mr-1" />
                                                        {new Date(job.postedAt).toLocaleDateString()}
                                                    </Badge>
                                                )}
                                                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="border-t border-card-border mt-8">
                <div className="max-w-4xl mx-auto px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} {company.name}. Powered by PeopleFlow HRMS.
                    </p>
                </div>
            </footer>
        </div>
    );
}
