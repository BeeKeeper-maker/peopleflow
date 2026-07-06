"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GitPullRequest, Mail, Phone, ChevronRight, UserPlus } from "lucide-react";
import Link from "next/link";

interface Application {
    id: string;
    stage: string;
    status: string;
    rating: number | null;
    interviewDate: string | null;
    offerSalary: number | null;
    candidate: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
        yearsOfExp: number | null;
        currentTitle: string | null;
        currentCompany: string | null;
    };
    jobPosting: {
        id: string;
        title: string;
        department: { name: string } | null;
        designation: { name: string } | null;
    };
}

const STAGES = [
    { key: "applied", label: "Applied", color: "bg-blue-500/20 text-blue-400" },
    { key: "screening", label: "Screening", color: "bg-cyan-500/20 text-cyan-400" },
    { key: "interview", label: "Interview", color: "bg-yellow-500/20 text-yellow-400" },
    { key: "technical", label: "Technical", color: "bg-orange-500/20 text-orange-400" },
    { key: "hr", label: "HR Round", color: "bg-purple-500/20 text-purple-400" },
    { key: "offer", label: "Offer", color: "bg-green-500/20 text-green-400" },
    { key: "hired", label: "Hired", color: "bg-emerald-500/20 text-emerald-400" },
];

export default function PipelinePage() {
    const { addToast } = useToast();
    const { confirm, dialog: confirmDialog } = useConfirmDialog();
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState<string>("all");
    const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);

    const fetchApplications = useCallback(async () => {
        try {
            const params = selectedJob !== "all" ? `?jobPostingId=${selectedJob}` : "";
            const res = await fetch(`/api/recruitment/applications${params}`);
            if (res.ok) {
                const data = await res.json();
                setApplications(data.data || []);
            }
        } catch {
            addToast({ title: "Error", description: "Failed to load pipeline", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [selectedJob, addToast]);

    useEffect(() => {
        fetch("/api/recruitment/jobs")
            .then((r) => r.json())
            .then((data) => setJobs(data.data || data || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    const moveStage = async (applicationId: string, newStage: string) => {
        try {
            const res = await fetch(`/api/recruitment/applications/${applicationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stage: newStage, status: "in_progress" }),
            });
            if (res.ok) {
                addToast({ title: `Moved to ${newStage}`, type: "success" });
                fetchApplications();
            }
        } catch {
            addToast({ title: "Error", description: "Failed to move", type: "error" });
        }
    };

    const reject = async (applicationId: string) => {
        const _ok = await confirm({ title: "Reject this candidate?", description: "The candidate will be moved to rejected stage.", confirmLabel: "Reject", variant: "destructive" }); if (!_ok) return;
        try {
            const res = await fetch(`/api/recruitment/applications/${applicationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stage: "rejected", status: "failed" }),
            });
            if (res.ok) {
                addToast({ title: "Candidate rejected", type: "success" });
                fetchApplications();
            }
        } catch {
            addToast({ title: "Error", description: "Failed to reject", type: "error" });
        }
    };

    const onboard = async (applicationId: string) => {
        const _ok2 = await confirm({ title: "Onboard this candidate?", description: "An employee record will be created with invitation email.", confirmLabel: "Hire & Onboard", variant: "default" }); if (!_ok2) return;
        try {
            const res = await fetch(`/api/recruitment/applications/${applicationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stage: "hired", onboardEmployee: true }),
            });
            if (res.ok) {
                const data = await res.json();
                addToast({
                    title: "Candidate hired & onboarded",
                    description: data.message || `Employee ${data.onboardedEmployee?.employeeCode || ""} created`,
                    type: "success",
                });
                fetchApplications();
            }
        } catch {
            addToast({ title: "Error", description: "Failed to onboard", type: "error" });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
                Loading pipeline...
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <GitPullRequest className="h-6 w-6" />
                        Recruitment Pipeline
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Drag candidates through stages or use the action buttons
                    </p>
                </div>
                <select
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                    className="bg-hover border border-card-border rounded-md px-3 py-2 text-sm"
                >
                    <option value="all">All Jobs</option>
                    {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                            {j.title}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-7 gap-3 overflow-x-auto">
                {STAGES.map((stage) => {
                    const stageApps = applications.filter((a) => a.stage === stage.key);
                    return (
                        <div key={stage.key} className="space-y-2">
                            <div className="flex items-center justify-between sticky top-0 bg-card z-10 py-2">
                                <Badge className={stage.color}>{stage.label}</Badge>
                                <span className="text-xs text-muted-foreground">{stageApps.length}</span>
                            </div>
                            <div className="space-y-2 min-h-[200px]">
                                {stageApps.map((app) => (
                                    <Card key={app.id} className="bg-card border-card-border">
                                        <CardContent className="p-3 space-y-2">
                                            <div>
                                                <div className="font-medium text-sm">
                                                    {app.candidate.firstName} {app.candidate.lastName}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {app.jobPosting.title}
                                                </div>
                                            </div>
                                            {app.candidate.currentTitle && (
                                                <div className="text-xs text-muted-foreground">
                                                    {app.candidate.currentTitle}
                                                    {app.candidate.yearsOfExp !== null && ` · ${app.candidate.yearsOfExp}y`}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <a href={`mailto:${app.candidate.email}`}>
                                                    <Mail className="h-3 w-3" />
                                                </a>
                                                {app.candidate.phone && (
                                                    <a href={`tel:${app.candidate.phone}`}>
                                                        <Phone className="h-3 w-3" />
                                                    </a>
                                                )}
                                                {app.rating && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        ★ {app.rating}
                                                    </Badge>
                                                )}
                                            </div>
                                            {/* Stage actions */}
                                            <div className="flex gap-1 pt-1 border-t border-card-border">
                                                {stage.key !== "hired" && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 text-xs px-2"
                                                        onClick={() => {
                                                            const nextIdx = STAGES.findIndex((s) => s.key === stage.key) + 1;
                                                            if (nextIdx < STAGES.length) {
                                                                moveStage(app.id, STAGES[nextIdx].key);
                                                            }
                                                        }}
                                                    >
                                                        <ChevronRight className="h-3 w-3" />
                                                        Next
                                                    </Button>
                                                )}
                                                {stage.key === "offer" && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 text-xs px-2 text-green-400"
                                                        onClick={() => onboard(app.id)}
                                                    >
                                                        <UserPlus className="h-3 w-3" />
                                                        Hire
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 text-xs px-2 text-red-400"
                                                    onClick={() => reject(app.id)}
                                                >
                                                    Reject
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {stageApps.length === 0 && (
                                    <div className="text-center text-xs text-muted-foreground py-4">
                                        Empty
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end">
                <Link href="/recruitment/candidates">
                    <Button variant="outline">
                        View All Candidates
                    </Button>
                </Link>
            </div>
        </div>
    );
}
