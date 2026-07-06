"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useTranslations } from "next-intl";
import {
    Calendar,
    Plus,
    CheckCircle2,
    XCircle,
    Clock,
    FileText,
    AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaveBalance {
    leaveType: {
        id: string;
        name: string;
        nameBn?: string;
        code: string;
        color?: string;
    };
    allocatedDays: number;
    usedDays: number;
    carriedForward: number;
    remainingDays: number;
}

interface LeaveApplication {
    id: string;
    leaveType: {
        name: string;
        code: string;
    };
    fromDate: string;
    toDate: string;
    totalDays: number;
    reason: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    createdAt: string;
    approvedBy?: {
        firstName: string;
        lastName: string;
    };
    rejectionReason?: string;
}

export default function ESSLeavesPage() {
    const t = useTranslations("ESSLeaves");
    const { addToast } = useToast();
    const { confirm, dialog: confirmDialog } = useConfirmDialog();
    const [isLoading, setIsLoading] = useState(true);
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [applications, setApplications] = useState<LeaveApplication[]>([]);
    const [activeTab, setActiveTab] = useState("balances");
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [profileMissing, setProfileMissing] = useState(false);

    const handleCancelApplication = async (appId: string) => {
        const _ok = await confirm({ title: t("cancelConfirm"), description: "This leave application will be cancelled.", confirmLabel: "Cancel Leave", variant: "destructive" }); if (!_ok) return;
        setCancellingId(appId);
        try {
            const res = await fetch(`/api/leaves/applications/${appId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "cancelled" }),
            });
            if (res.ok) {
                setApplications((prev) =>
                    prev.map((a) => a.id === appId ? { ...a, status: "cancelled" } : a)
                );
                addToast({ title: t("cancelSuccess"), type: "success" });
            } else {
                addToast({ title: t("cancelFailed"), type: "error" });
            }
        } catch (error) {
            console.error("Error cancelling leave:", error);
            addToast({ title: t("errorOccurred"), type: "error" });
        } finally {
            setCancellingId(null);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch real data from APIs
                const [balancesRes, applicationsRes] = await Promise.all([
                    fetch("/api/leaves/allocations"),
                    fetch("/api/leaves/applications"),
                ]);

                if (balancesRes.ok) {
                    const data = await balancesRes.json();
                    setBalances(data.data || data || []);
                    setProfileMissing(false);
                } else if (balancesRes.status === 400 || balancesRes.status === 404) {
                    setProfileMissing(true);
                }

                if (applicationsRes.ok) {
                    const data = await applicationsRes.json();
                    setApplications(data.data || data || []);
                }
            } catch (error) {
                console.error("Error fetching data:", error); addToast({ title: "Failed to load data. Please refresh.", type: "error" }); addToast({ title: "Failed to load data. Please refresh.", type: "error" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        {t("pending")}
                    </Badge>
                );
            case "approved":
                return (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t("approved")}
                    </Badge>
                );
            case "rejected":
                return (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        {t("rejected")}
                    </Badge>
                );
            case "cancelled":
                return (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                        {t("cancelled")}
                    </Badge>
                );
            default:
                return null;
        }
    };

    const getColorClass = (color: string | undefined) => {
        switch (color) {
            case "blue":
                return "from-blue-500/20 to-blue-600/10 border-blue-500/20";
            case "red":
                return "from-red-500/20 to-red-600/10 border-red-500/20";
            case "green":
                return "from-green-500/20 to-green-600/10 border-green-500/20";
            case "purple":
                return "from-purple-500/20 to-purple-600/10 border-purple-500/20";
            case "orange":
                return "from-orange-500/20 to-orange-600/10 border-orange-500/20";
            default:
                return "from-blue-500/20 to-blue-600/10 border-blue-500/20";
        }
    };

    const getProgressColor = (color: string | undefined) => {
        switch (color) {
            case "blue":
                return "from-blue-500 to-blue-600";
            case "red":
                return "from-red-500 to-red-600";
            case "green":
                return "from-green-500 to-green-600";
            case "purple":
                return "from-purple-500 to-purple-600";
            case "orange":
                return "from-orange-500 to-orange-600";
            default:
                return "from-blue-500 to-blue-600";
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t("subtitle")}
                    </p>
                </div>
                {profileMissing ? (
                    <Button className="bg-blue-600 hover:bg-blue-500" disabled>
                        <Plus className="h-4 w-4 mr-2" />
                        {t("applyForLeave")}
                    </Button>
                ) : (
                    <Link href="/ess/leaves/apply">
                        <Button className="bg-blue-600 hover:bg-blue-500">
                            <Plus className="h-4 w-4 mr-2" />
                            {t("applyForLeave")}
                        </Button>
                    </Link>
                )}
            </div>

            {profileMissing && (
                <Card className="border-amber-500/20 bg-amber-500/10">
                    <CardContent className="flex items-start gap-3 p-4">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                        <div>
                            <h2 className="font-semibold text-amber-200">{t("profileNotLinkedTitle")}</h2>
                            <p className="mt-1 text-sm text-amber-100/80">{t("profileNotLinkedDesc")}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-card border border-card-border">
                    <TabsTrigger
                        value="balances"
                        className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
                    >
                        {t("leaveBalance")}
                    </TabsTrigger>
                    <TabsTrigger
                        value="applications"
                        className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
                    >
                        {t("myApplications")}
                    </TabsTrigger>
                </TabsList>

                {/* Leave Balance Tab */}
                <TabsContent value="balances" className="mt-6">
                    {balances.length === 0 ? (
                        <Card className="bg-card border-card-border">
                            <CardContent className="py-12 text-center">
                                {profileMissing ? (
                                    <AlertTriangle className="h-12 w-12 mx-auto text-amber-400 mb-4" />
                                ) : (
                                    <Calendar className="h-12 w-12 mx-auto text-muted-text mb-4" />
                                )}
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    {profileMissing ? t("profileNotLinkedTitle") : t("noLeaveTypes")}
                                </h3>
                                <p className="text-tertiary-foreground">
                                    {profileMissing ? t("profileNotLinkedDesc") : t("contactHR")}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {balances.map((balance) => (
                                <Card
                                    key={balance.leaveType.id}
                                    className={`bg-linear-to-br ${getColorClass(balance.leaveType.color)} border`}
                                >
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-2xl font-display font-bold text-muted-text">
                                                {balance.leaveType.code}
                                            </span>
                                            <Calendar className="h-5 w-5 text-tertiary-foreground" />
                                        </div>
                                        <p className="text-sm text-muted-foreground">{balance.leaveType.name}</p>
                                        {balance.leaveType.nameBn && (
                                            <p className="text-xs text-tertiary-foreground">{balance.leaveType.nameBn}</p>
                                        )}
                                        <div className="mt-4 flex items-end gap-2">
                                            <span className="text-4xl font-bold tabular-nums text-foreground">
                                                {balance.remainingDays}
                                            </span>
                                            <span className="text-sm text-tertiary-foreground mb-1">
                                                / {balance.allocatedDays} {t("days")}
                                            </span>
                                        </div>
                                        <div className="mt-4 h-2 rounded-full bg-hover overflow-hidden">
                                            <div
                                                className={`h-full rounded-full bg-linear-to-r ${getProgressColor(balance.leaveType.color)}`}
                                                style={{
                                                    width: `${balance.allocatedDays > 0 ? (balance.remainingDays / balance.allocatedDays) * 100 : 0}%`,
                                                }}
                                            />
                                        </div>
                                        <div className="mt-2 flex justify-between text-xs text-tertiary-foreground">
                                            <span>{t("used")}: {balance.usedDays}</span>
                                            <span>{t("remaining")}: {balance.remainingDays}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Applications Tab */}
                <TabsContent value="applications" className="mt-6">
                    <Card className="bg-card border-card-border">
                        <CardContent className="p-0">
                            {applications.length === 0 ? (
                                <div className="py-12 text-center">
                                    <FileText className="h-12 w-12 mx-auto text-muted-text mb-4" />
                                    <h3 className="text-lg font-medium text-foreground mb-2">
                                        {t("noApplications")}
                                    </h3>
                                    <p className="text-tertiary-foreground">
                                        {t("noApplicationsDesc")}
                                    </p>
                                    {profileMissing ? (
                                        <Button className="mt-4 bg-blue-600 hover:bg-blue-500" disabled>
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t("applyNow")}
                                        </Button>
                                    ) : (
                                        <Link href="/ess/leaves/apply">
                                            <Button className="mt-4 bg-blue-600 hover:bg-blue-500">
                                                <Plus className="h-4 w-4 mr-2" />
                                                {t("applyNow")}
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {applications.map((app) => (
                                        <div
                                            key={app.id}
                                            className="p-4 hover:bg-hover transition-colors"
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                        <FileText className="h-6 w-6 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-foreground">
                                                                {app.leaveType.name}
                                                            </p>
                                                            {getStatusBadge(app.status)}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {new Date(app.fromDate).toLocaleDateString()} -{" "}
                                                            {new Date(app.toDate).toLocaleDateString()} ({app.totalDays}{" "}
                                                            {app.totalDays === 1 ? t("day") : t("daysPlural")})
                                                        </p>
                                                        <p className="text-sm text-tertiary-foreground mt-1">
                                                            {t("reason")}: {app.reason}
                                                        </p>
                                                        {app.approvedBy && (
                                                            <p className="text-xs text-green-400/60 mt-1">
                                                                {t("approvedBy")}: {app.approvedBy.firstName} {app.approvedBy.lastName}
                                                            </p>
                                                        )}
                                                        {app.rejectionReason && (
                                                            <p className="text-xs text-red-400/60 mt-1">
                                                                {t("rejectionReason")}: {app.rejectionReason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-tertiary-foreground">
                                                        {t("applied")}: {new Date(app.createdAt).toLocaleDateString()}
                                                    </p>
                                                    {app.status === "pending" && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                            disabled={cancellingId === app.id}
                                                            onClick={() => handleCancelApplication(app.id)}
                                                        >
                                                            {cancellingId === app.id ? t("cancelling") : t("cancel")}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
