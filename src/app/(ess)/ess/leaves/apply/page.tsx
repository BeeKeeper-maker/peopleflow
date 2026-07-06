"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
    Calendar,
    ArrowLeft,
    FileText,
    Loader2,
    CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

interface LeaveType {
    id: string;
    name: string;
    nameBn?: string;
    code: string;
    maxDaysPerYear: number;
    remainingDays: number;
}

export default function ApplyLeavePage() {
    const t = useTranslations("ESSLeaves");
    const router = useRouter();
    const { addToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [isLoadingTypes, setIsLoadingTypes] = useState(true);

    const [formData, setFormData] = useState({
        leaveTypeId: "",
        startDate: "",
        endDate: "",
        reason: "",
        isHalfDay: false,
        halfDayType: "",
    });

    useEffect(() => {
        const fetchLeaveTypes = async () => {
            try {
                const res = await fetch("/api/leaves/allocations");
                if (res.ok) {
                    const data = await res.json();
                    const allocations = Array.isArray(data) ? data : data.data || [];
                    setLeaveTypes(allocations.map((allocation: {
                        leaveType: { id: string; name: string; nameBn?: string; code: string; annualAllocation: number };
                        remainingDays: number;
                    }) => ({
                        id: allocation.leaveType.id,
                        name: allocation.leaveType.name,
                        nameBn: allocation.leaveType.nameBn,
                        code: allocation.leaveType.code,
                        maxDaysPerYear: allocation.leaveType.annualAllocation,
                        remainingDays: allocation.remainingDays,
                    })));
                }
            } catch (error) {
                console.error("Error fetching leave types:", error);
            } finally {
                setIsLoadingTypes(false);
            }
        };

        fetchLeaveTypes();
    }, []);

    const selectedLeaveType = leaveTypes.find((lt) => lt.id === formData.leaveTypeId);

    const calculateDays = () => {
        if (!formData.startDate || !formData.endDate) return 0;
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return formData.isHalfDay ? 0.5 : Math.max(0, diff);
    };

    const totalDays = calculateDays();

    const handleSubmit = async () => {
        // Validation
        if (!formData.leaveTypeId) {
            addToast({ title: t("errSelectLeaveType"), type: "error" });
            return;
        }
        if (!formData.startDate) {
            addToast({ title: t("errStartDate"), type: "error" });
            return;
        }
        if (!formData.endDate) {
            addToast({ title: t("errEndDate"), type: "error" });
            return;
        }
        if (new Date(formData.endDate) < new Date(formData.startDate)) {
            addToast({ title: t("errEndBeforeStart"), type: "error" });
            return;
        }
        if (!formData.reason.trim()) {
            addToast({ title: t("errReason"), type: "error" });
            return;
        }
        if (formData.isHalfDay && !formData.halfDayType) {
            addToast({ title: t("errHalfDayType"), type: "error" });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/leaves/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leaveTypeId: formData.leaveTypeId,
                    fromDate: formData.startDate,
                    toDate: formData.endDate,
                    reason: formData.reason,
                    halfDay: formData.isHalfDay,
                    halfDayType: formData.halfDayType || undefined,
                    totalDays,
                }),
            });

            if (res.ok) {
                setIsSuccess(true);
            } else {
                const data = await res.json();
                addToast({ title: data.error || t("submitFailed"), type: "error" });
            }
        } catch (error) {
            console.error("Error submitting leave:", error);
            addToast({ title: t("submitFailed"), type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="bg-card border-card-border max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-400" />
                        </div>
                        <h2 className="text-xl font-display font-bold text-foreground mb-2">
                            {t("submitSuccess")}
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            {t("submitSuccessDesc")}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Link href="/ess/leaves">
                                <Button variant="outline" className="border-card-border">
                                    {t("viewMyLeaves")}
                                </Button>
                            </Link>
                            <Link href="/ess/dashboard">
                                <Button className="bg-blue-600 hover:bg-blue-500">
                                    {t("goToDashboard")}
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/ess/leaves">
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">{t("applyTitle")}</h1>
                    <p className="text-muted-foreground mt-1">{t("applySubtitle")}</p>
                </div>
            </div>

            {/* Form */}
            <Card className="bg-card border-card-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-400" />
                        {t("leaveDetails")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Leave Type */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">{t("leaveType")}</Label>
                        <Select
                            value={formData.leaveTypeId}
                            onValueChange={(value) => setFormData({ ...formData, leaveTypeId: value })}
                        >
                            <SelectTrigger className="bg-background border-card-border text-foreground">
                                <SelectValue placeholder={isLoadingTypes ? t("loading") : t("selectLeaveType")} />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-card-border">
                                {leaveTypes.map((lt) => (
                                    <SelectItem key={lt.id} value={lt.id}>
                                        {lt.name} {t("daysLeft", { count: lt.remainingDays })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">{t("fromDate")}</Label>
                            <Input
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                className="bg-background border-card-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">{t("toDate")}</Label>
                            <Input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className="bg-background border-card-border text-foreground"
                            />
                        </div>
                    </div>

                    {/* Half Day Toggle */}
                    <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t("halfDayLeave")}</p>
                        </div>
                        <Switch
                            checked={formData.isHalfDay}
                            onCheckedChange={(checked) =>
                                setFormData({ ...formData, isHalfDay: checked, halfDayType: "" })
                            }
                        />
                    </div>

                    {formData.isHalfDay && (
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">{t("selectHalf")}</Label>
                            <Select
                                value={formData.halfDayType}
                                onValueChange={(value) => setFormData({ ...formData, halfDayType: value })}
                            >
                                <SelectTrigger className="bg-background border-card-border text-foreground">
                                    <SelectValue placeholder={t("selectHalf")} />
                                </SelectTrigger>
                                <SelectContent className="bg-background border-card-border">
                                    <SelectItem value="first_half">{t("firstHalf")}</SelectItem>
                                    <SelectItem value="second_half">{t("secondHalf")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Days Summary */}
                    {totalDays > 0 && (
                        <div className="p-3 bg-blue-500/10 rounded-lg text-sm font-medium text-blue-400">
                            <Calendar className="h-4 w-4 inline mr-2" />
                            {totalDays === 1
                                ? t("daysOfLeave", { count: totalDays })
                                : t("daysOfLeavePlural", { count: totalDays })}
                        </div>
                    )}

                    {/* Reason */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">{t("reasonLabel")}</Label>
                        <Textarea
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            rows={4}
                            placeholder={t("reasonPlaceholder")}
                            className="bg-background border-card-border text-foreground"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end">
                        <Link href="/ess/leaves">
                            <Button variant="outline" className="border-card-border">
                                {t("cancelBtn")}
                            </Button>
                        </Link>
                        <Button
                            className="bg-blue-600 hover:bg-blue-500"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t("submitting")}
                                </>
                            ) : (
                                t("submitApplication")
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
