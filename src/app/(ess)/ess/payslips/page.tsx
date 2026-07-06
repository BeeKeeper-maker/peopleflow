"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
    Receipt,
    Download,
    Calendar,
    Eye,
    FileText,
    TrendingUp,
    TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

import { useToast } from "@/components/ui/toast";
interface Payslip {
    id: string;
    month: number; // API returns number (1-12)
    year: number;
    basicSalary: number;
    houseRent: number;
    medicalAllowance: number; // API field name
    conveyance: number;
    specialAllowance?: number;
    overtime?: number;
    bonus?: number;
    festivalBonus?: number;
    arrears?: number;
    otherEarnings: number;
    pfEmployee: number; // API field name (not pfDeduction)
    pfEmployer?: number;
    incomeTax: number; // API field name (not taxDeduction)
    loanDeduction?: number;
    absentDeduction?: number;
    lateDeduction?: number;
    otherDeductions: number;
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    status: "draft" | "approved" | "paid" | "reversed"; // actual API statuses
    paymentDate?: string; // API field name (not paidDate)
    paymentMode?: string;
    presentDays?: number;
    absentDays?: number;
    leaveDays?: number;
    totalWorkingDays?: number;
}

export default function ESSPayslipsPage() {
    const { addToast } = useToast();
    const t = useTranslations("ESSPayslips");
    const [isLoading, setIsLoading] = useState(true);
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

    useEffect(() => {
        const fetchPayslips = async () => {
            try {
                const res = await fetch("/api/payroll/payslips");
                if (res.ok) {
                    const data = await res.json();
                    setPayslips(data.data || data || []);
                }
            } catch (error) {
                console.error("Error fetching payslips:", error);
                addToast({ title: "Failed to load data. Please refresh the page.", type: "error" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchPayslips();
    }, []);

    const latestPayslip = payslips[0];
    const previousPayslip = payslips[1];
    const salaryChange = latestPayslip && previousPayslip
        ? ((latestPayslip.netSalary - previousPayslip.netSalary) / previousPayslip.netSalary) * 100
        : 0;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <div>
                <h1 className="text-2xl font-display font-bold text-foreground">{t("title")}</h1>
                <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
            </div>

            {/* Summary Cards */}
            {latestPayslip && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-card border-card-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    <Receipt className="h-5 w-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t("latestNetSalary")}</p>
                                    <p className="text-xl font-display font-bold text-green-400">
                                        {formatCurrency(latestPayslip.netSalary)}
                                    </p>
                                    {salaryChange !== 0 && (
                                        <div className="flex items-center gap-1 mt-1">
                                            {salaryChange > 0 ? (
                                                <TrendingUp className="h-3 w-3 text-green-400" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3 text-red-400" />
                                            )}
                                            <span className={`text-xs ${salaryChange > 0 ? "text-green-400" : "text-red-400"}`}>
                                                {salaryChange > 0 ? "+" : ""}{salaryChange.toFixed(1)}% {t("vsLastMonth")}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-card-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t("grossSalary")}</p>
                                    <p className="text-xl font-display font-bold text-foreground">
                                        {formatCurrency(latestPayslip.grossSalary)}
                                    </p>
                                    <p className="text-xs text-tertiary-foreground">{t("beforeDeductions")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-card-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                    <TrendingDown className="h-5 w-5 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t("totalDeductions")}</p>
                                    <p className="text-xl font-display font-bold text-red-400">
                                        {formatCurrency(latestPayslip.totalDeductions)}
                                    </p>
                                    <p className="text-xs text-tertiary-foreground">{t("pfTaxOthers")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Payslip History */}
            <Card className="bg-card border-card-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-400" />
                        {t("payslipHistory")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {payslips.length === 0 ? (
                        <div className="p-8 text-center">
                            <Receipt className="h-12 w-12 text-muted-text mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">
                                {t("noPayslips")}
                            </h3>
                            <p className="text-tertiary-foreground">{t("noPayslipsDesc")}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {payslips.map((payslip) => (
                                <div
                                    key={payslip.id}
                                    className="p-4 hover:bg-hover transition-colors"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                <Calendar className="h-6 w-6 text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {new Date(payslip.year, payslip.month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {t("net")}: {formatCurrency(payslip.netSalary)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge
                                                className={
                                                    payslip.status === "paid"
                                                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                                                        : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                                }
                                            >
                                                {payslip.status === "paid" ? t("paid") : t("pending")}
                                            </Badge>
                                            {payslip.paymentDate && (
                                                <span className="text-xs text-tertiary-foreground">
                                                    {t("paidOn")} {new Date(payslip.paymentDate).toLocaleDateString()}
                                                </span>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-blue-400 hover:text-blue-300"
                                                onClick={() => setSelectedPayslip(payslip)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
                                                {t("viewBtn")}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payslip Detail Dialog */}
            <Dialog open={!!selectedPayslip} onOpenChange={(open) => { if (!open) setSelectedPayslip(null); }}>
                <DialogContent className="max-w-lg bg-card border-card-border max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            {selectedPayslip && t("payslipTitle", { month: new Date(selectedPayslip.year, selectedPayslip.month - 1, 1).toLocaleDateString("en-US", { month: "long" }), year: selectedPayslip.year })}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedPayslip && (
                        <div className="space-y-6">
                            {/* Earnings */}
                            <div>
                                <h3 className="text-sm font-semibold text-green-400 mb-3">{t("earnings")}</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t("basicSalary")}</span>
                                        <span className="text-foreground">{formatCurrency(selectedPayslip.basicSalary)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t("houseRent")}</span>
                                        <span className="text-foreground">{formatCurrency(selectedPayslip.houseRent)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t("medical")}</span>
                                        <span className="text-foreground">{formatCurrency(selectedPayslip.medicalAllowance)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t("conveyance")}</span>
                                        <span className="text-foreground">{formatCurrency(selectedPayslip.conveyance)}</span>
                                    </div>
                                    {selectedPayslip.otherEarnings > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t("otherEarnings")}</span>
                                            <span className="text-foreground">{formatCurrency(selectedPayslip.otherEarnings)}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-card-border pt-2 flex justify-between font-semibold">
                                        <span className="text-foreground">{t("grossSalary")}</span>
                                        <span className="text-green-400">{formatCurrency(selectedPayslip.grossSalary)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Deductions */}
                            <div>
                                <h3 className="text-sm font-semibold text-red-400 mb-3">{t("deductions")}</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t("pfEmployee")}</span>
                                        <span className="text-foreground">{formatCurrency(selectedPayslip.pfEmployee)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t("incomeTax")}</span>
                                        <span className="text-foreground">{formatCurrency(selectedPayslip.incomeTax)}</span>
                                    </div>
                                    {selectedPayslip.otherDeductions > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t("otherDeductions")}</span>
                                            <span className="text-foreground">{formatCurrency(selectedPayslip.otherDeductions)}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-card-border pt-2 flex justify-between font-semibold">
                                        <span className="text-foreground">{t("totalDeductions")}</span>
                                        <span className="text-red-400">{formatCurrency(selectedPayslip.totalDeductions)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Net Salary */}
                            <div className="bg-blue-500/10 rounded-xl p-4 flex justify-between items-center">
                                <span className="text-lg font-bold text-foreground">{t("netSalary")}</span>
                                <span className="text-2xl font-display font-bold text-blue-400">
                                    {formatCurrency(selectedPayslip.netSalary)}
                                </span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
