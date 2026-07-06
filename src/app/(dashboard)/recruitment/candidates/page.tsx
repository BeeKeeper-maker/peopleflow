"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Users,
    Search,
    Mail,
    Phone,
    Briefcase,
    Plus,
    Eye,
    Trash2,
    FileText,
} from "lucide-react";
import Link from "next/link";

interface Candidate {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    resumeUrl: string | null;
    portfolioUrl: string | null;
    linkedinUrl: string | null;
    currentCompany: string | null;
    currentTitle: string | null;
    yearsOfExp: number | null;
    expectedSalary: number | null;
    noticePeriod: string | null;
    skills: string | null;
    education: string | null;
    source: string | null;
    notes: string | null;
    applications: Array<{
        id: string;
        stage: string;
        status: string;
        jobPosting: {
            id: string;
            title: string;
            department: { name: string } | null;
        };
    }>;
}

export default function CandidatesPage() {
    const { addToast } = useToast();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);

    const fetchCandidates = useCallback(async () => {
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : "";
            const res = await fetch(`/api/recruitment/candidates${params}`);
            if (res.ok) {
                const data = await res.json();
                setCandidates(data.data || []);
            }
        } catch {
            addToast({ title: "Error", description: "Failed to load candidates", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [search, addToast]);

    useEffect(() => {
        const timer = setTimeout(fetchCandidates, 300);
        return () => clearTimeout(timer);
    }, [fetchCandidates]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <Users className="h-6 w-6" />
                        Candidates
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} in your talent pool
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/recruitment/pipeline">
                        <Button variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View Pipeline
                        </Button>
                    </Link>
                    <Button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Candidate
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email, phone, or company..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-hover border-card-border"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading candidates...</div>
            ) : candidates.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Users className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No candidates yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Candidates who apply via your public career page will appear here.
                            You can also add candidates manually.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {candidates.map((candidate) => (
                        <Card key={candidate.id}>
                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-medium">
                                        {candidate.firstName[0]}
                                        {candidate.lastName[0]}
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">
                                            {candidate.firstName} {candidate.lastName}
                                        </CardTitle>
                                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Mail className="h-3 w-3" />
                                                {candidate.email}
                                            </span>
                                            {candidate.phone && (
                                                <span className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {candidate.phone}
                                                </span>
                                            )}
                                            {candidate.currentTitle && (
                                                <span className="flex items-center gap-1">
                                                    <Briefcase className="h-3 w-3" />
                                                    {candidate.currentTitle}
                                                    {candidate.currentCompany && ` at ${candidate.currentCompany}`}
                                                </span>
                                            )}
                                            {candidate.yearsOfExp !== null && (
                                                <Badge variant="secondary">{candidate.yearsOfExp}y exp</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {candidate.resumeUrl && (
                                        <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer">
                                            <Button variant="ghost" size="icon" title="View resume">
                                                <FileText className="h-4 w-4" />
                                            </Button>
                                        </a>
                                    )}
                                </div>
                            </CardHeader>
                            {candidate.applications.length > 0 && (
                                <CardContent className="pt-0">
                                    <div className="text-xs text-muted-foreground mb-2">Applied for:</div>
                                    <div className="flex flex-wrap gap-2">
                                        {candidate.applications.map((app) => (
                                            <Badge
                                                key={app.id}
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {app.jobPosting.title}
                                                <span className="ml-1 text-muted-foreground">
                                                    ({app.stage})
                                                </span>
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {showAddForm && (
                <AddCandidateDialog
                    onClose={() => setShowAddForm(false)}
                    onSaved={() => {
                        setShowAddForm(false);
                        fetchCandidates();
                    }}
                />
            )}
        </div>
    );
}

function AddCandidateDialog({
    onClose,
    onSaved,
}: {
    onClose: () => void;
    onSaved: () => void;
}) {
    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        currentCompany: "",
        currentTitle: "",
        yearsOfExp: "",
        skills: "",
        source: "manual",
    });

    const handleSave = async () => {
        if (!form.firstName || !form.lastName || !form.email) {
            addToast({ title: "Error", description: "Name and email are required", type: "error" });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/recruitment/candidates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    yearsOfExp: form.yearsOfExp ? Number(form.yearsOfExp) : undefined,
                }),
            });
            if (res.ok) {
                addToast({ title: "Candidate added", type: "success" });
                onSaved();
            } else {
                const err = await res.json();
                addToast({ title: "Error", description: err.error || "Failed to add", type: "error" });
            }
        } catch {
            addToast({ title: "Error", description: "Network error", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg bg-card border-card-border">
                <CardHeader>
                    <CardTitle>Add Candidate</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            placeholder="First name *"
                            value={form.firstName}
                            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                            className="bg-hover border-card-border"
                        />
                        <Input
                            placeholder="Last name *"
                            value={form.lastName}
                            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                            className="bg-hover border-card-border"
                        />
                    </div>
                    <Input
                        placeholder="Email *"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="bg-hover border-card-border"
                    />
                    <Input
                        placeholder="Phone"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="bg-hover border-card-border"
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            placeholder="Current company"
                            value={form.currentCompany}
                            onChange={(e) => setForm({ ...form, currentCompany: e.target.value })}
                            className="bg-hover border-card-border"
                        />
                        <Input
                            placeholder="Current title"
                            value={form.currentTitle}
                            onChange={(e) => setForm({ ...form, currentTitle: e.target.value })}
                            className="bg-hover border-card-border"
                        />
                    </div>
                    <Input
                        placeholder="Years of experience"
                        type="number"
                        value={form.yearsOfExp}
                        onChange={(e) => setForm({ ...form, yearsOfExp: e.target.value })}
                        className="bg-hover border-card-border"
                    />
                    <Input
                        placeholder="Skills (comma-separated)"
                        value={form.skills}
                        onChange={(e) => setForm({ ...form, skills: e.target.value })}
                        className="bg-hover border-card-border"
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            {saving ? "Saving..." : "Add Candidate"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
