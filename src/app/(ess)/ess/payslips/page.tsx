"use client";

import { useEffect, useState } from "react";
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
import { formatCurrency } from "@/lib/utils";

interface Payslip {
    id: string;
    month: string;
    year: number;
    generatedOn: string;

    // Earnings
    basic: number;
    houseRent: number;
    medical: number;
    conveyance: number;
    otherEarnings: number;
    grossSalary: number;

    // Deductions
    pfEmployee: number;
    incomeTax: number;
    otherDeductions: number;
    totalDeductions: number;

    // Net
    netSalary: number;

    // Status
    status: "paid" | "pending";
    paidOn?: string;
}

export default function ESSPayslipsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                await new Promise((resolve) => setTimeout(resolve, 1000));

                setPayslips([
                    {
                        id: "1",
                        month: "January",
                        year: 2026,
                        generatedOn: "2026-02-01",
                        basic: 50000,
                        houseRent: 25000,
                        medical: 5000,
                        conveyance: 3000,
                        otherEarnings: 7000,
                        grossSalary: 90000,
                        pfEmployee: 5000,
                        incomeTax: 3500,
                        otherDeductions: 2000,
                        totalDeductions: 10500,
                        netSalary: 79500,
                        status: "paid",
                        paidOn: "2026-02-05",
                    },
                    {
                        id: "2",
                        month: "December",
                        year: 2025,
                        generatedOn: "2026-01-01",
                        basic: 50000,
                        houseRent: 25000,
                        medical: 5000,
                        conveyance: 3000,
                        otherEarnings: 7000,
                        grossSalary: 90000,
                        pfEmployee: 5000,
                        incomeTax: 3500,
                        otherDeductions: 1500,
                        totalDeductions: 10000,
                        netSalary: 80000,
                        status: "paid",
                        paidOn: "2026-01-05",
                    },
                    {
                        id: "3",
                        month: "November",
                        year: 2025,
                        generatedOn: "2025-12-01",
                        basic: 50000,
                        houseRent: 25000,
                        medical: 5000,
                        conveyance: 3000,
                        otherEarnings: 5000,
                        grossSalary: 88000,
                        pfEmployee: 5000,
                        incomeTax: 3200,
                        otherDeductions: 1000,
                        totalDeductions: 9200,
                        netSalary: 78800,
                        status: "paid",
                        paidOn: "2025-12-05",
                    },
                ]);
            } catch (error) {
                console.error("Error fetching payslips:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleViewPayslip = (payslip: Payslip) => {
        setSelectedPayslip(payslip);
    };

    const handleDownloadPDF = (payslipId: string) => {
        // TODO: Implement PDF download
        console.log("Downloading PDF for payslip:", payslipId);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                </div>
            </div>
        );
    }

    const latestPayslip = payslips[0];
    const previousPayslip = payslips[1];
    const salaryChange = latestPayslip && previousPayslip
        ? latestPayslip.netSalary - previousPayslip.netSalary
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">My Payslips</h1>
                <p className="text-white/60 mt-1">
                    View and download your salary slips
                </p>
            </div>

            {/* Summary Cards */}
            {latestPayslip && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/20">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-white/60">Latest Net Salary</span>
                                <Receipt className="h-5 w-5 text-green-400" />
                            </div>
                            <p className="text-3xl font-bold text-white">
                                {formatCurrency(latestPayslip.netSalary)}
                            </p>
                            <p className="text-sm text-white/40 mt-1">
                                {latestPayslip.month} {latestPayslip.year}
                            </p>
                            {salaryChange !== 0 && (
                                <div className="flex items-center gap-1 mt-2">
                                    {salaryChange > 0 ? (
                                        <>
                                            <TrendingUp className="h-4 w-4 text-green-400" />
                                            <span className="text-sm text-green-400">
                                                +{formatCurrency(salaryChange)}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <TrendingDown className="h-4 w-4 text-red-400" />
                                            <span className="text-sm text-red-400">
                                                {formatCurrency(salaryChange)}
                                            </span>
                                        </>
                                    )}
                                    <span className="text-xs text-white/40">vs last month</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/20">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-white/60">Gross Salary</span>
                                <TrendingUp className="h-5 w-5 text-blue-400" />
                            </div>
                            <p className="text-3xl font-bold text-white">
                                {formatCurrency(latestPayslip.grossSalary)}
                            </p>
                            <p className="text-sm text-white/40 mt-1">
                                Before deductions
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/20">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-white/60">Total Deductions</span>
                                <TrendingDown className="h-5 w-5 text-red-400" />
                            </div>
                            <p className="text-3xl font-bold text-white">
                                {formatCurrency(latestPayslip.totalDeductions)}
                            </p>
                            <p className="text-sm text-white/40 mt-1">
                                PF + Tax + Others
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Payslip List */}
            <Card className="bg-[#141419] border-white/5">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-400" />
                        Payslip History
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                        {payslips.map((payslip) => (
                            <div
                                key={payslip.id}
                                className="p-4 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                            <Receipt className="h-6 w-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">
                                                {payslip.month} {payslip.year}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-sm text-white/60">
                                                    Net: {formatCurrency(payslip.netSalary)}
                                                </span>
                                                <Badge
                                                    className={
                                                        payslip.status === "paid"
                                                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                                                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                                    }
                                                >
                                                    {payslip.status === "paid" ? "Paid" : "Pending"}
                                                </Badge>
                                            </div>
                                            {payslip.paidOn && (
                                                <p className="text-xs text-white/40 mt-1">
                                                    Paid on: {new Date(payslip.paidOn).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleViewPayslip(payslip)}
                                            className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
                                        >
                                            <Eye className="h-4 w-4 mr-2" />
                                            View
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleDownloadPDF(payslip.id)}
                                            className="bg-blue-600 hover:bg-blue-500"
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            PDF
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Payslip Detail Modal/Drawer would go here */}
            {selectedPayslip && (
                <Card className="bg-[#141419] border-white/5">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-white">
                            Payslip - {selectedPayslip.month} {selectedPayslip.year}
                        </CardTitle>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedPayslip(null)}
                            className="text-white/60 hover:text-white"
                        >
                            Close
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Earnings */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-green-400">Earnings</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Basic Salary</span>
                                        <span className="text-white">{formatCurrency(selectedPayslip.basic)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">House Rent</span>
                                        <span className="text-white">{formatCurrency(selectedPayslip.houseRent)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Medical</span>
                                        <span className="text-white">{formatCurrency(selectedPayslip.medical)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Conveyance</span>
                                        <span className="text-white">{formatCurrency(selectedPayslip.conveyance)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Other Earnings</span>
                                        <span className="text-white">{formatCurrency(selectedPayslip.otherEarnings)}</span>
                                    </div>
                                    <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                                        <span className="text-white">Gross Salary</span>
                                        <span className="text-green-400">{formatCurrency(selectedPayslip.grossSalary)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Deductions */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-red-400">Deductions</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-white/60">PF (Employee)</span>
                                        <span className="text-white">{formatCurrency(selectedPayslip.pfEmployee)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Income Tax</span>
                                        <span className="text-white">{formatCurrency(selectedPayslip.incomeTax)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Other Deductions</span>
                                        <span className="text-white">{formatCurrency(selectedPayslip.otherDeductions)}</span>
                                    </div>
                                    <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                                        <span className="text-white">Total Deductions</span>
                                        <span className="text-red-400">{formatCurrency(selectedPayslip.totalDeductions)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Net Salary */}
                        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-white/10">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold text-white">Net Salary</span>
                                <span className="text-2xl font-bold text-white">
                                    {formatCurrency(selectedPayslip.netSalary)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
