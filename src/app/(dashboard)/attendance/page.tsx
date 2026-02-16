"use client";

import { useState, useEffect } from "react";
import { AttendanceDashboardCard } from "@/components/attendance/attendance-dashboard-card";
import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";
import {
    Clock,
    CheckCircle2,
    XCircle,
    Calendar,
    ClipboardEdit,
    Loader2,
    Plus,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

interface RegularizationRequest {
    id: string;
    date: string;
    reason: string;
    requestedCheckIn?: string;
    requestedCheckOut?: string;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
    employee: {
        firstName: string;
        lastName: string;
        employeeCode: string;
        department?: { name: string };
    };
    approvedBy?: {
        firstName: string;
        lastName: string;
    };
}

const statusConfig = {
    pending: { label: "Pending", color: "bg-amber-500/20 text-amber-400", icon: Clock },
    approved: { label: "Approved", color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle2 },
    rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400", icon: XCircle },
};

// ════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════

export default function AttendancePage() {
    const t = useTranslations('Attendance');
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [requests, setRequests] = useState<RegularizationRequest[]>([]);
    const [loadingReqs, setLoadingReqs] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // New request form
    const [formDate, setFormDate] = useState("");
    const [formCheckIn, setFormCheckIn] = useState("");
    const [formCheckOut, setFormCheckOut] = useState("");
    const [formReason, setFormReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (activeTab === "regularization") fetchRequests();
    }, [activeTab]);

    const fetchRequests = async () => {
        setLoadingReqs(true);
        try {
            const res = await fetch("/api/attendance/regularization");
            if (res.ok) {
                const data = await res.json();
                setRequests(data.requests || []);
            }
        } catch (error) {
            console.error("Failed to fetch regularization requests:", error);
        } finally {
            setLoadingReqs(false);
        }
    };

    const handleAction = async (id: string, action: "approve" | "reject") => {
        setProcessing(id);
        try {
            const res = await fetch(`/api/attendance/regularization/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (res.ok) {
                addToast({ title: `Request ${action}d`, description: `Regularization request has been ${action}d.`, type: "success" });
                fetchRequests();
            } else {
                const err = await res.json();
                addToast({ title: "Error", description: err.error || `Failed to ${action}`, type: "error" });
            }
        } catch {
            addToast({ title: "Error", description: "Network error", type: "error" });
        } finally {
            setProcessing(null);
        }
    };

    const handleSubmitRequest = async () => {
        if (!formDate || !formReason) {
            addToast({ title: "Missing fields", description: "Date and reason are required.", type: "error" });
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/attendance/regularization", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: formDate,
                    requestedCheckIn: formCheckIn || undefined,
                    requestedCheckOut: formCheckOut || undefined,
                    reason: formReason,
                }),
            });
            if (res.ok) {
                addToast({ title: "Request Submitted", description: "Your regularization request has been submitted.", type: "success" });
                setShowForm(false);
                setFormDate("");
                setFormCheckIn("");
                setFormCheckOut("");
                setFormReason("");
                fetchRequests();
            } else {
                const err = await res.json();
                addToast({ title: "Error", description: err.error || "Failed to submit", type: "error" });
            }
        } catch {
            addToast({ title: "Error", description: "Network error", type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const pendingCount = requests.filter(r => r.status === "pending").length;

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h2>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-hover border-card-border">
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="regularization" className="gap-2">
                        <ClipboardEdit className="h-4 w-4" />
                        Regularization
                        {pendingCount > 0 && (
                            <Badge className="bg-amber-500/20 text-amber-400 text-[10px] ml-1">
                                {pendingCount}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Original Dashboard Tab */}
                <TabsContent value="dashboard" className="mt-4">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                        <div className="col-span-4 lg:col-span-3 space-y-6">
                            <AttendanceDashboardCard />
                        </div>
                        <div className="col-span-4">
                            <AttendanceHistory />
                        </div>
                    </div>
                </TabsContent>

                {/* Regularization Tab */}
                <TabsContent value="regularization" className="mt-4 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">Attendance Regularization</h3>
                            <p className="text-sm text-muted-foreground">Request corrections to attendance records</p>
                        </div>
                        <Button className="gap-2" onClick={() => setShowForm(!showForm)}>
                            <Plus className="h-4 w-4" />
                            New Request
                        </Button>
                    </div>

                    {/* New Request Form */}
                    {showForm && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Submit Regularization Request</CardTitle>
                                <CardDescription>Correct your attendance for a specific date</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Input
                                            type="date"
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Requested Check-In Time</Label>
                                        <Input
                                            type="time"
                                            value={formCheckIn}
                                            onChange={(e) => setFormCheckIn(e.target.value)}
                                            placeholder="09:00"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Requested Check-Out Time</Label>
                                        <Input
                                            type="time"
                                            value={formCheckOut}
                                            onChange={(e) => setFormCheckOut(e.target.value)}
                                            placeholder="18:00"
                                        />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Reason</Label>
                                        <textarea
                                            value={formReason}
                                            onChange={(e) => setFormReason(e.target.value)}
                                            className="w-full h-20 px-3 py-2 rounded-lg bg-hover border border-card-border text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Reason for attendance regularization..."
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                                    <Button onClick={handleSubmitRequest} disabled={submitting} className="gap-2">
                                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardEdit className="h-4 w-4" />}
                                        Submit Request
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: "Pending", value: requests.filter(r => r.status === "pending").length, bgColor: "bg-amber-500/20", textColor: "text-amber-400", icon: Clock },
                            { label: "Approved", value: requests.filter(r => r.status === "approved").length, bgColor: "bg-emerald-500/20", textColor: "text-emerald-400", icon: CheckCircle2 },
                            { label: "Rejected", value: requests.filter(r => r.status === "rejected").length, bgColor: "bg-red-500/20", textColor: "text-red-400", icon: XCircle },
                        ].map((s, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bgColor}`}>
                                            <s.icon className={`h-5 w-5 ${s.textColor}`} />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-foreground">{s.value}</p>
                                            <p className="text-xs text-muted-foreground">{s.label}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Requests List */}
                    <div className="space-y-3">
                        {loadingReqs ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <Card key={i}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <Skeleton className="h-10 w-10 rounded-full" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-40" />
                                                <Skeleton className="h-3 w-60" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : requests.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center">
                                    <ClipboardEdit className="h-12 w-12 text-tertiary-foreground mx-auto mb-3" />
                                    <p className="text-muted-foreground">No regularization requests</p>
                                    <p className="text-sm text-tertiary-foreground mt-1">
                                        Submit a request to correct attendance for any missing or incorrect records
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            requests.map((req) => {
                                const config = statusConfig[req.status];
                                const StatusIcon = config.icon;
                                return (
                                    <Card key={req.id} className="hover:border-border transition-colors">
                                        <CardContent className="p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                                <Avatar className="h-10 w-10 shrink-0">
                                                    <AvatarFallback className="text-xs">
                                                        {req.employee.firstName[0]}{req.employee.lastName[0]}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground">
                                                        {req.employee.firstName} {req.employee.lastName}
                                                        <span className="text-muted-foreground ml-2">({req.employee.employeeCode})</span>
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(req.date).toLocaleDateString()}
                                                        </span>
                                                        {req.requestedCheckIn && (
                                                            <span className="text-xs text-blue-400">In: {req.requestedCheckIn}</span>
                                                        )}
                                                        {req.requestedCheckOut && (
                                                            <span className="text-xs text-purple-400">Out: {req.requestedCheckOut}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{req.reason}</p>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    <Badge className={`${config.color} text-[10px]`}>
                                                        <StatusIcon className="h-3 w-3 mr-1" />
                                                        {config.label}
                                                    </Badge>

                                                    {req.status === "pending" && (
                                                        <div className="flex gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                                                onClick={() => handleAction(req.id, "approve")}
                                                                disabled={processing === req.id}
                                                            >
                                                                {processing === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                                onClick={() => handleAction(req.id, "reject")}
                                                                disabled={processing === req.id}
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
