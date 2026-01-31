"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

interface LeaveType {
    id: string;
    name: string;
    remaining: number;
}

export default function ApplyLeavePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

    const [formData, setFormData] = useState({
        leaveType: "",
        fromDate: "",
        toDate: "",
        reason: "",
        isHalfDay: false,
        halfDayType: "", // 'first_half' or 'second_half'
        attachments: [] as File[],
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Calculate number of days
    const calculateDays = () => {
        if (!formData.fromDate || !formData.toDate) return 0;
        const from = new Date(formData.fromDate);
        const to = new Date(formData.toDate);
        const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return formData.isHalfDay ? 0.5 : Math.max(0, diff);
    };

    useEffect(() => {
        // Fetch leave types
        setLeaveTypes([
            { id: "cl", name: "Casual Leave", remaining: 8 },
            { id: "sl", name: "Sick Leave", remaining: 11 },
            { id: "al", name: "Annual Leave", remaining: 10 },
            { id: "co", name: "Compensatory Leave", remaining: 2 },
        ]);
    }, []);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.leaveType) {
            newErrors.leaveType = "Please select a leave type";
        }
        if (!formData.fromDate) {
            newErrors.fromDate = "Start date is required";
        }
        if (!formData.toDate) {
            newErrors.toDate = "End date is required";
        }
        if (formData.fromDate && formData.toDate) {
            const from = new Date(formData.fromDate);
            const to = new Date(formData.toDate);
            if (to < from) {
                newErrors.toDate = "End date cannot be before start date";
            }
        }
        if (!formData.reason.trim()) {
            newErrors.reason = "Reason is required";
        }
        if (formData.isHalfDay && !formData.halfDayType) {
            newErrors.halfDayType = "Please select half day type";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsLoading(true);

        try {
            // TODO: Call API to submit leave application
            await new Promise((resolve) => setTimeout(resolve, 1500));

            setIsSubmitted(true);
        } catch (error) {
            console.error("Error submitting leave:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="bg-[#141419] border-white/5 max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">
                            Leave Application Submitted!
                        </h2>
                        <p className="text-white/60 mb-6">
                            Your leave request has been submitted for approval. You'll be notified
                            once your manager reviews it.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Link href="/ess/leaves">
                                <Button
                                    variant="outline"
                                    className="border-white/10 text-white/60 hover:text-white"
                                >
                                    View My Leaves
                                </Button>
                            </Link>
                            <Link href="/ess/dashboard">
                                <Button className="bg-blue-600 hover:bg-blue-500">
                                    Go to Dashboard
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/ess/leaves">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/60 hover:text-white hover:bg-white/5"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Apply for Leave</h1>
                    <p className="text-white/60 mt-1">
                        Submit a new leave request to your manager
                    </p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
                <Card className="bg-[#141419] border-white/5">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-400" />
                            Leave Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Leave Type */}
                        <div className="space-y-2">
                            <Label className="text-white">Leave Type *</Label>
                            <Select
                                value={formData.leaveType}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, leaveType: value })
                                }
                            >
                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="Select leave type" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A1A1F] border-white/10">
                                    {leaveTypes.map((type) => (
                                        <SelectItem
                                            key={type.id}
                                            value={type.id}
                                            className="text-white hover:bg-white/10"
                                        >
                                            <div className="flex items-center justify-between w-full gap-4">
                                                <span>{type.name}</span>
                                                <span className="text-xs text-white/40">
                                                    ({type.remaining} days left)
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.leaveType && (
                                <p className="text-sm text-red-400">{errors.leaveType}</p>
                            )}
                        </div>

                        {/* Date Range */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-white">From Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.fromDate}
                                    onChange={(e) =>
                                        setFormData({ ...formData, fromDate: e.target.value })
                                    }
                                    className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
                                />
                                {errors.fromDate && (
                                    <p className="text-sm text-red-400">{errors.fromDate}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white">To Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.toDate}
                                    onChange={(e) =>
                                        setFormData({ ...formData, toDate: e.target.value })
                                    }
                                    className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
                                />
                                {errors.toDate && (
                                    <p className="text-sm text-red-400">{errors.toDate}</p>
                                )}
                            </div>
                        </div>

                        {/* Half Day Option */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="halfDay"
                                    checked={formData.isHalfDay}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            isHalfDay: e.target.checked,
                                            // Auto-set toDate same as fromDate for half day
                                            toDate: e.target.checked ? formData.fromDate : formData.toDate,
                                        })
                                    }
                                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-600"
                                />
                                <Label htmlFor="halfDay" className="text-white cursor-pointer">
                                    Half Day Leave
                                </Label>
                            </div>

                            {formData.isHalfDay && (
                                <div className="space-y-2 pl-7">
                                    <Label className="text-white/60">Select Half</Label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="halfDayType"
                                                value="first_half"
                                                checked={formData.halfDayType === "first_half"}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, halfDayType: e.target.value })
                                                }
                                                className="h-4 w-4 border-white/20 bg-white/5 text-blue-600"
                                            />
                                            <span className="text-white">First Half (Morning)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="halfDayType"
                                                value="second_half"
                                                checked={formData.halfDayType === "second_half"}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, halfDayType: e.target.value })
                                                }
                                                className="h-4 w-4 border-white/20 bg-white/5 text-blue-600"
                                            />
                                            <span className="text-white">Second Half (Afternoon)</span>
                                        </label>
                                    </div>
                                    {errors.halfDayType && (
                                        <p className="text-sm text-red-400">{errors.halfDayType}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Days Summary */}
                        {calculateDays() > 0 && (
                            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-blue-400" />
                                    <span className="text-blue-400 font-medium">
                                        {calculateDays()} day{calculateDays() !== 1 ? "s" : ""} of leave
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Reason */}
                        <div className="space-y-2">
                            <Label className="text-white">Reason for Leave *</Label>
                            <Textarea
                                value={formData.reason}
                                onChange={(e) =>
                                    setFormData({ ...formData, reason: e.target.value })
                                }
                                placeholder="Please provide a reason for your leave..."
                                className="bg-white/5 border-white/10 text-white min-h-[100px]"
                            />
                            {errors.reason && (
                                <p className="text-sm text-red-400">{errors.reason}</p>
                            )}
                        </div>

                        {/* Submit */}
                        <div className="flex items-center justify-end gap-4 pt-4">
                            <Link href="/ess/leaves">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-white/10 text-white/60 hover:text-white"
                                >
                                    Cancel
                                </Button>
                            </Link>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-blue-600 hover:bg-blue-500"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    "Submit Application"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
