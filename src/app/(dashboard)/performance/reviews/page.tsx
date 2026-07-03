"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Target,
    Plus,
    Play,
    Pause,
    CheckCircle2,
    Trash2,
    Calendar,
    Users,
    Loader2,
} from "lucide-react";

interface ReviewCycle {
    id: string;
    name: string;
    description: string | null;
    type: string;
    status: string;
    startDate: string;
    endDate: string;
    _count: { goals: number; reviews: number };
}

const TYPE_LABELS: Record<string, string> = {
    quarterly: "Quarterly",
    biannual: "Bi-Annual",
    annual: "Annual",
};

const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    active: "bg-green-500/20 text-green-400",
    completed: "bg-blue-500/20 text-blue-400",
};

export default function ReviewCyclesPage() {
    const { addToast } = useToast();
    const [cycles, setCycles] = useState<ReviewCycle[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const fetchCycles = useCallback(async () => {
        try {
            const res = await fetch("/api/performance/review-cycles");
            if (res.ok) {
                const data = await res.json();
                setCycles(data.data || []);
            }
        } catch {
            addToast({ title: "Error", description: "Failed to load cycles", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchCycles();
    }, [fetchCycles]);

    const handleActivate = async (id: string) => {
        try {
            const res = await fetch(`/api/performance/review-cycles/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "active" }),
            });
            if (res.ok) {
                addToast({ title: "Cycle activated", type: "success" });
                fetchCycles();
            }
        } catch {
            addToast({ title: "Error", description: "Failed to activate", type: "error" });
        }
    };

    const handleComplete = async (id: string) => {
        if (!confirm("Complete this review cycle? No more reviews can be submitted.")) return;
        try {
            const res = await fetch(`/api/performance/review-cycles/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "completed" }),
            });
            if (res.ok) {
                addToast({ title: "Cycle completed", type: "success" });
                fetchCycles();
            }
        } catch {
            addToast({ title: "Error", description: "Failed to complete", type: "error" });
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="space-y-6 p-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Target className="h-6 w-6" />
                        Review Cycles
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage performance review periods — create, activate, and complete cycles.
                    </p>
                </div>
                <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Cycle
                </Button>
            </div>

            {cycles.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Target className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No review cycles yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Create a quarterly, bi-annual, or annual review cycle to start.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {cycles.map((cycle) => (
                        <Card key={cycle.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        {cycle.name}
                                        <Badge className={STATUS_COLORS[cycle.status] || "bg-gray-500/20"}>
                                            {cycle.status}
                                        </Badge>
                                    </CardTitle>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(cycle.startDate).toLocaleDateString()} - {new Date(cycle.endDate).toLocaleDateString()}
                                        </span>
                                        <Badge variant="secondary">{TYPE_LABELS[cycle.type] || cycle.type}</Badge>
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            {cycle._count.reviews} reviews
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {cycle.status === "draft" && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-green-400 border-green-400/30 hover:bg-green-500/10"
                                            onClick={() => handleActivate(cycle.id)}
                                        >
                                            <Play className="h-3 w-3 mr-1" />
                                            Activate
                                        </Button>
                                    )}
                                    {cycle.status === "active" && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-blue-400 border-blue-400/30 hover:bg-blue-500/10"
                                            onClick={() => handleComplete(cycle.id)}
                                        >
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Complete
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            {cycle.description && (
                                <CardContent className="pt-0">
                                    <p className="text-sm text-muted-foreground">{cycle.description}</p>
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {showForm && (
                <CycleForm
                    onClose={() => setShowForm(false)}
                    onSaved={() => {
                        setShowForm(false);
                        fetchCycles();
                    }}
                />
            )}
        </div>
    );
}

function CycleForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [type, setType] = useState("quarterly");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [description, setDescription] = useState("");

    const handleSave = async () => {
        if (!name || !startDate || !endDate) {
            addToast({ title: "Error", description: "Name, start date, and end date are required", type: "error" });
            return;
        }
        if (new Date(startDate) >= new Date(endDate)) {
            addToast({ title: "Error", description: "End date must be after start date", type: "error" });
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/performance/review-cycles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    type,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                    description: description || undefined,
                }),
            });
            if (res.ok) {
                addToast({ title: "Review cycle created", type: "success" });
                onSaved();
            } else {
                const err = await res.json().catch(() => ({}));
                addToast({ title: err.error || "Failed to create", type: "error" });
            }
        } catch {
            addToast({ title: "Network error", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg bg-card border-card-border">
                <CardHeader>
                    <CardTitle>Create Review Cycle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <label className="text-sm font-medium">Cycle Name *</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Q3 2026 Performance Review"
                            className="mt-1 bg-hover border-card-border"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="mt-1 w-full bg-hover border border-card-border rounded-md px-3 py-2"
                        >
                            <option value="quarterly">Quarterly</option>
                            <option value="biannual">Bi-Annual</option>
                            <option value="annual">Annual</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium">Start Date *</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1 bg-hover border-card-border"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">End Date *</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1 bg-hover border-card-border"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Description</label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description"
                            className="mt-1 bg-hover border-card-border"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            {saving ? "Creating..." : "Create Cycle"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
