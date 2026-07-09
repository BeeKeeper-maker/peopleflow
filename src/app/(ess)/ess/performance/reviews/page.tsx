"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Star, Target, Loader2, CheckCircle2, Users } from "lucide-react";

interface Review {
    id: string;
    status: string;
    selfRating: number | null;
    selfComments: string | null;
    managerRating: number | null;
    managerComments: string | null;
    overallRating: number | null;
    strengths: string | null;
    improvements: string | null;
    employee: { firstName: string; lastName: string; employeeCode: string };
    reviewCycle: { id: string; name: string; type: string };
}

export default function ESSPerformanceReviewsPage() {
    const { addToast } = useToast();
    const tShared = useTranslations("SharedComponents");
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReview, setSelectedReview] = useState<Review | null>(null);
    const [selfRating, setSelfRating] = useState(0);
    const [selfComments, setSelfComments] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchReviews(); }, []);

    const fetchReviews = async () => {
        try {
            const res = await fetch("/api/performance/reviews?my=true");
            if (res.ok) { const data = await res.json(); setReviews(data.data || []); }
        } catch { addToast({ title: tShared("error"), description: tShared("failedLoadData"), type: "error" }); }
        finally { setLoading(false); }
    };

    const handleSubmit = async () => {
        if (!selectedReview) return;
        if (selfRating < 1 || selfRating > 5) { addToast({ title: tShared("selectRating"), type: "error" }); return; }
        if (!selfComments.trim()) { addToast({ title: tShared("writeComments"), type: "error" }); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`/api/performance/reviews/${selectedReview.id}?action=self`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selfRating, selfComments }),
            });
            if (res.ok) {
                const data = await res.json();
                addToast({ title: data.message || tShared("reviewSubmitted"), type: "success" });
                setSelectedReview(null); setSelfRating(0); setSelfComments("");
                fetchReviews();
            } else { const err = await res.json().catch(() => ({})); addToast({ title: err.error || tShared("reviewFailed"), type: "error" }); }
        } catch { addToast({ title: tShared("networkError"), type: "error" }); }
        finally { setSubmitting(false); }
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div>;

    if (selectedReview) {
        return (
            <div className="space-y-6 max-w-3xl">
                <h1 className="text-2xl font-display font-bold tabular-nums">Self-Assessment</h1>
                <p className="text-muted-foreground">{selectedReview.reviewCycle.name}</p>
                <Card>
                    <CardHeader><CardTitle>Rate Your Performance</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-2">Rating (1-5)</label>
                            <div className="flex gap-2">
                                {[1,2,3,4,5].map((s) => (
                                    <button key={s} onClick={() => setSelfRating(s)}
                                        className={`transition-colors ${s <= selfRating ? "text-yellow-400" : "text-muted-foreground"}`}>
                                        <Star className="h-8 w-8" fill={s <= selfRating ? "currentColor" : "none"} />
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">1=Below · 3=Meets · 5=Exceeds</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-2">Comments</label>
                            <Textarea value={selfComments} onChange={(e) => setSelfComments(e.target.value)} rows={8}
                                placeholder="Describe your achievements, challenges, and growth areas..."
                                className="bg-hover border-card-border" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => { setSelectedReview(null); setSelfRating(0); setSelfComments(""); }}>Cancel</Button>
                            <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                {submitting ? "Submitting..." : "Submit"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Target className="h-6 w-6" /> My Reviews</h1>
            {reviews.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center py-16">
                    <Target className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No reviews assigned</p>
                    <p className="text-sm text-muted-foreground mt-1">Your HR will assign you to review cycles.</p>
                </CardContent></Card>
            ) : (
                <div className="grid gap-4">
                    {reviews.map((r) => (
                        <Card key={r.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                                <div>
                                    <CardTitle className="text-lg">{r.reviewCycle.name}</CardTitle>
                                    <Badge className="mt-1">
                                        {r.status === "pending" ? "Awaiting self-assessment" :
                                         r.status === "self_review" ? "Awaiting manager review" :
                                         r.status === "completed" ? "Completed" : r.status}
                                    </Badge>
                                </div>
                                {r.status === "pending" && (
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => { setSelectedReview(r); setSelfRating(r.selfRating||0); setSelfComments(r.selfComments||""); }}>
                                        Start Self-Assessment
                                    </Button>
                                )}
                            </CardHeader>
                            {r.status === "completed" && (
                                <CardContent className="pt-0">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded"><p className="text-xs text-blue-400">Self</p>
                                            <div className="flex gap-0.5 mt-1">{[1,2,3,4,5].map(s => <Star key={s} className="h-3 w-3" fill={s<=(r.selfRating||0)?"currentColor":"none"} color={s<=(r.selfRating||0)?"#eab308":"currentColor"} />)}</div></div>
                                        <div className="p-2 bg-purple-500/10 rounded"><p className="text-xs text-purple-400">Manager</p>
                                            <div className="flex gap-0.5 mt-1">{[1,2,3,4,5].map(s => <Star key={s} className="h-3 w-3" fill={s<=(r.managerRating||0)?"currentColor":"none"} color={s<=(r.managerRating||0)?"#eab308":"currentColor"} />)}</div></div>
                                        <div className="p-2 bg-green-500/10 rounded"><p className="text-xs text-green-400">Overall</p>
                                            <div className="flex gap-0.5 mt-1">{[1,2,3,4,5].map(s => <Star key={s} className="h-3 w-3" fill={s<=(r.overallRating||0)?"currentColor":"none"} color={s<=(r.overallRating||0)?"#eab308":"currentColor"} />)}</div></div>
                                    </div>
                                    {r.strengths && <p className="text-sm mt-2"><span className="text-green-400 font-medium">Strengths: </span>{r.strengths}</p>}
                                    {r.improvements && <p className="text-sm mt-1"><span className="text-amber-400 font-medium">Improvements: </span>{r.improvements}</p>}
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
