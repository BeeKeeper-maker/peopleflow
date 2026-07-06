"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Star, Users, Loader2, CheckCircle2, Eye } from "lucide-react";

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
    employee: { id: string; firstName: string; lastName: string; employeeCode: string; designation?: { name: string }; department?: { name: string } };
    reviewCycle: { id: string; name: string; type: string };
}

export default function ManagerReviewsPage() {
    const { addToast } = useToast();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReview, setSelectedReview] = useState<Review | null>(null);
    const [managerRating, setManagerRating] = useState(0);
    const [managerComments, setManagerComments] = useState("");
    const [strengths, setStrengths] = useState("");
    const [improvements, setImprovements] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchReviews(); }, []);

    const fetchReviews = async () => {
        try {
            const res = await fetch("/api/performance/reviews");
            if (res.ok) { const data = await res.json(); setReviews(data.data || []); }
        } catch { addToast({ title: "Error", description: "Failed to load", type: "error" }); }
        finally { setLoading(false); }
    };

    const handleSubmit = async () => {
        if (!selectedReview) return;
        if (managerRating < 1 || managerRating > 5) { addToast({ title: "Select a rating", type: "error" }); return; }
        if (!managerComments.trim()) { addToast({ title: "Write your comments", type: "error" }); return; }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/performance/reviews/${selectedReview.id}?action=manager`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    managerRating, managerComments,
                    strengths: strengths || undefined,
                    improvements: improvements || undefined,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                addToast({ title: data.message || "Manager review submitted", type: "success" });
                setSelectedReview(null); setManagerRating(0); setManagerComments(""); setStrengths(""); setImprovements("");
                fetchReviews();
            } else { const err = await res.json().catch(() => ({})); addToast({ title: err.error || "Failed", type: "error" }); }
        } catch { addToast({ title: "Network error", type: "error" }); }
        finally { setSubmitting(false); }
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div>;

    if (selectedReview) {
        return (
            <div className="space-y-6 max-w-3xl">
                <div>
                    <h1 className="text-2xl font-display font-bold tabular-nums">Manager Review</h1>
                    <p className="text-muted-foreground mt-1">
                        {selectedReview.employee.firstName} {selectedReview.employee.lastName} — {selectedReview.reviewCycle.name}
                    </p>
                </div>

                {/* Self-assessment display */}
                {selectedReview.selfRating && (
                    <Card className="bg-blue-500/5 border-blue-500/20">
                        <CardHeader><CardTitle className="text-sm text-blue-400">Employee Self-Assessment</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex gap-1 mb-2">
                                {[1,2,3,4,5].map(s => <Star key={s} className="h-5 w-5" fill={s<=selectedReview.selfRating!?"currentColor":"none"} color={s<=selectedReview.selfRating!?"#eab308":"currentColor"} />)}
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedReview.selfComments}</p>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader><CardTitle>Your Manager Review</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-2">Rating (1-5)</label>
                            <div className="flex gap-2">
                                {[1,2,3,4,5].map(s => (
                                    <button key={s} onClick={() => setManagerRating(s)}
                                        className={`transition-colors ${s <= managerRating ? "text-yellow-400" : "text-muted-foreground"}`}>
                                        <Star className="h-8 w-8" fill={s <= managerRating ? "currentColor" : "none"} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-2">Review Comments</label>
                            <Textarea value={managerComments} onChange={(e) => setManagerComments(e.target.value)} rows={6}
                                placeholder="Provide detailed feedback on the employee's performance..."
                                className="bg-hover border-card-border" />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-2">Key Strengths (optional)</label>
                            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3}
                                placeholder="What are the employee's key strengths?"
                                className="bg-hover border-card-border" />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-2">Areas for Improvement (optional)</label>
                            <Textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={3}
                                placeholder="What should the employee focus on improving?"
                                className="bg-hover border-card-border" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => { setSelectedReview(null); setManagerRating(0); setManagerComments(""); setStrengths(""); setImprovements(""); }}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                {submitting ? "Submitting..." : "Submit Review"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Team Performance Reviews</h1>
            {reviews.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center py-16">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No reviews to manage</p>
                    <p className="text-sm text-muted-foreground mt-1">Reviews will appear here when HR assigns them.</p>
                </CardContent></Card>
            ) : (
                <div className="grid gap-4">
                    {reviews.map(r => (
                        <Card key={r.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                                <div>
                                    <CardTitle className="text-lg">{r.employee.firstName} {r.employee.lastName}</CardTitle>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                        <span>{r.employee.employeeCode}</span>
                                        {r.employee.designation && <span>· {r.employee.designation.name}</span>}
                                        <Badge variant="secondary">{r.reviewCycle.name}</Badge>
                                        <Badge className={
                                            r.status === "completed" ? "bg-blue-500/20 text-blue-400" :
                                            r.status === "self_review" ? "bg-green-500/20 text-green-400" :
                                            "bg-gray-500/20 text-gray-400"
                                        }>
                                            {r.status === "pending" ? "Awaiting self-assessment" :
                                             r.status === "self_review" ? "Ready for your review" :
                                             r.status === "completed" ? "Completed" : r.status}
                                        </Badge>
                                    </div>
                                </div>
                                {r.status === "self_review" && (
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => { setSelectedReview(r); setManagerRating(r.managerRating||0); setManagerComments(r.managerComments||""); setStrengths(r.strengths||""); setImprovements(r.improvements||""); }}>
                                        Review Now
                                    </Button>
                                )}
                                {r.status === "completed" && (
                                    <Button size="sm" variant="outline"
                                        onClick={() => { setSelectedReview(r); setManagerRating(r.managerRating||0); setManagerComments(r.managerComments||""); setStrengths(r.strengths||""); setImprovements(r.improvements||""); }}>
                                        <Eye className="h-3 w-3 mr-1" /> View
                                    </Button>
                                )}
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
