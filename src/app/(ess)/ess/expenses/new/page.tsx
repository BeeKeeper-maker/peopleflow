"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
    Receipt,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    Upload,
    Calendar,
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
import { useToast } from "@/components/ui/toast";

interface ExpenseCategory {
    id: string;
    name: string;
    nameBn?: string;
    maxAmount?: number;
    monthlyLimit?: number;
    requiresReceipt: boolean;
    categoryType: string; // standard, mileage, per_diem
    mileageRate?: number | null;
    perDiemRate?: number | null;
}

export default function NewExpensePage() {
    const t = useTranslations("ESSExpenses");
    const router = useRouter();
    const { addToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

    const [formData, setFormData] = useState({
        title: "",
        amount: "",
        currency: "BDT",
        category: "",
        date: "",
        description: "",
        receipt: null as File | null,
        // Mileage
        distance: "",
        distanceUnit: "km",
        // Per-diem
        perDiemDays: "",
    });

    // Fetch exchange rates for currency display
    useEffect(() => {
        fetch("/api/settings/exchange-rates")
            .then((r) => r.json())
            .then((data) => {
                const rateMap: Record<string, number> = { BDT: 1.0 };
                for (const c of data.data || []) {
                    if (c.rate) rateMap[c.code] = c.rate;
                }
                setExchangeRates(rateMap);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch("/api/expenses/categories");
                if (res.ok) {
                    const data = await res.json();
                    setCategories(data.data || data || []);
                } else {
                    // Use default categories if API not available
                    setCategories([
                        { id: "travel", name: "Travel", maxAmount: 10000, monthlyLimit: 50000, requiresReceipt: true, categoryType: "standard" },
                        { id: "meals", name: "Meals", maxAmount: 2000, monthlyLimit: 15000, requiresReceipt: false, categoryType: "standard" },
                        { id: "office", name: "Office Supplies", maxAmount: 5000, monthlyLimit: 20000, requiresReceipt: true, categoryType: "standard" },
                        { id: "communication", name: "Communication", maxAmount: 3000, monthlyLimit: 10000, requiresReceipt: false, categoryType: "standard" },
                        { id: "other", name: "Other", maxAmount: 10000, monthlyLimit: 30000, requiresReceipt: true, categoryType: "standard" },
                    ]);
                }
            } catch (error) {
                console.error("Error fetching categories:", error);
            } finally {
                setIsLoadingCategories(false);
            }
        };

        fetchCategories();
    }, []);

    const selectedCategory = categories.find((c) => c.id === formData.category);

    const handleSubmit = async (asDraft = false) => {
        // Validation
        if (!formData.title.trim()) {
            addToast({ title: t("errTitle"), type: "error" });
            return;
        }
        if (!formData.category) {
            addToast({ title: t("errCategory"), type: "error" });
            return;
        }
        if (!formData.date) {
            addToast({ title: t("errExpenseDate"), type: "error" });
            return;
        }

        // Type-specific validation
        const catType = selectedCategory?.categoryType || "standard";
        if (catType === "standard") {
            if (!formData.amount || parseFloat(formData.amount) <= 0) {
                addToast({ title: t("errAmount"), type: "error" });
                return;
            }
        } else if (catType === "mileage") {
            if (!formData.distance || parseFloat(formData.distance) <= 0) {
                addToast({ title: "Distance is required for mileage claims", type: "error" });
                return;
            }
        } else if (catType === "per_diem") {
            if (!formData.perDiemDays || parseFloat(formData.perDiemDays) <= 0) {
                addToast({ title: "Number of days is required for per-diem claims", type: "error" });
                return;
            }
        }

        if (selectedCategory?.requiresReceipt && !formData.receipt && !asDraft) {
            addToast({ title: t("errReceipt"), type: "error" });
            return;
        }

        setIsSubmitting(true);
        try {
            let receiptUrl: string | undefined;
            let receiptName: string | undefined;

            if (formData.receipt) {
                const uploadData = new FormData();
                uploadData.append("file", formData.receipt);
                uploadData.append("folder", "receipts");
                uploadData.append("prefix", "expense-receipt");

                const uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: uploadData,
                });

                const uploadJson = await uploadRes.json().catch(() => null);
                if (!uploadRes.ok) {
                    throw new Error(uploadJson?.error?.message || uploadJson?.error || "Receipt upload failed");
                }

                receiptUrl = uploadJson?.data?.url;
                receiptName = uploadJson?.data?.originalName || formData.receipt.name;
            }

            // Build request body based on category type
            const requestBody: Record<string, unknown> = {
                title: formData.title,
                categoryId: formData.category,
                expenseDate: formData.date,
                description: formData.description || undefined,
                status: asDraft ? "draft" : "submitted",
                receiptUrl,
                receiptName,
            };

            if (catType === "standard") {
                requestBody.amount = Number(formData.amount);
                requestBody.currency = formData.currency;
            } else if (catType === "mileage") {
                requestBody.distance = Number(formData.distance);
                requestBody.distanceUnit = formData.distanceUnit;
                // Currency is always BDT for mileage
            } else if (catType === "per_diem") {
                requestBody.perDiemDays = Number(formData.perDiemDays);
            }

            const res = await fetch("/api/expenses/claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            if (res.ok) {
                setIsSuccess(true);
            } else {
                const data = await res.json().catch(() => null);
                addToast({ title: data?.error || t("errTitle"), type: "error" });
            }
        } catch (error) {
            console.error("Error submitting expense:", error);
            addToast({ title: t("errTitle"), type: "error" });
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
                        <h2 className="text-xl font-bold text-foreground mb-2">
                            {t("submitSuccess")}
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            {t("submitSuccessDesc")}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Link href="/ess/expenses">
                                <Button variant="outline" className="border-card-border">
                                    {t("viewMyExpenses")}
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
                <Link href="/ess/expenses">
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t("newClaimTitle")}</h1>
                    <p className="text-muted-foreground mt-1">{t("newClaimSubtitle")}</p>
                </div>
            </div>

            {/* Form */}
            <Card className="bg-card border-card-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-blue-400" />
                        {t("expenseDetails")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Category */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">{t("categoryLabel")}</Label>
                        <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                            <SelectTrigger className="bg-background border-card-border text-foreground">
                                <SelectValue placeholder={t("selectCategory")} />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-card-border">
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Category Limits Info */}
                    {selectedCategory && (
                        <div className="p-3 bg-blue-500/10 rounded-lg text-sm space-y-1">
                            <p className="font-medium text-blue-400">{t("categoryLimits")}</p>
                            {selectedCategory.maxAmount && (
                                <p className="text-muted-foreground">
                                    {t("maxPerClaim", { amount: selectedCategory.maxAmount.toLocaleString() })}
                                </p>
                            )}
                            {selectedCategory.monthlyLimit && (
                                <p className="text-muted-foreground">
                                    {t("monthlyLimit", { amount: selectedCategory.monthlyLimit.toLocaleString() })}
                                </p>
                            )}
                            {selectedCategory.requiresReceipt && (
                                <p className="text-yellow-400 text-xs">{t("receiptRequiredNote")}</p>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">{t("titleLabel")}</Label>
                        <Input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder={t("titlePlaceholder")}
                            className="bg-background border-card-border text-foreground"
                        />
                    </div>

                    {/* Amount / Distance / Per-diem — depends on category type */}
                    {(!selectedCategory || selectedCategory.categoryType === "standard") && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">{t("amountLabel")}</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="0.00"
                                        className="bg-background border-card-border text-foreground flex-1"
                                    />
                                    <select
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        className="bg-background border border-card-border rounded-md px-3 text-sm w-28"
                                    >
                                        <option value="BDT">৳ BDT</option>
                                        <option value="USD">$ USD</option>
                                        <option value="EUR">€ EUR</option>
                                        <option value="GBP">£ GBP</option>
                                        <option value="INR">₹ INR</option>
                                        <option value="SGD">S$ SGD</option>
                                        <option value="AED">AED</option>
                                        <option value="SAR">SAR</option>
                                        <option value="MYR">RM MYR</option>
                                        <option value="AUD">A$ AUD</option>
                                        <option value="CAD">C$ CAD</option>
                                    </select>
                                </div>
                                {/* Show BDT equivalent for foreign currencies */}
                                {formData.currency !== "BDT" && formData.amount && exchangeRates[formData.currency] && (
                                    <p className="text-xs text-muted-foreground">
                                        ≈ ৳{(parseFloat(formData.amount) * exchangeRates[formData.currency]).toLocaleString("en-BD", { maximumFractionDigits: 2 })}
                                    </p>
                                )}
                                {formData.currency !== "BDT" && formData.amount && !exchangeRates[formData.currency] && (
                                    <p className="text-xs text-yellow-400">
                                        No exchange rate cached for {formData.currency}. HR must update rates.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">{t("expenseDateLabel")}</Label>
                                <Input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="bg-background border-card-border text-foreground"
                                />
                            </div>
                        </div>
                    )}

                    {/* Mileage input */}
                    {selectedCategory?.categoryType === "mileage" && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">Distance</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={formData.distance}
                                        onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                                        placeholder="0.0"
                                        className="bg-background border-card-border text-foreground flex-1"
                                    />
                                    <select
                                        value={formData.distanceUnit}
                                        onChange={(e) => setFormData({ ...formData, distanceUnit: e.target.value })}
                                        className="bg-background border border-card-border rounded-md px-3 text-sm w-20"
                                    >
                                        <option value="km">km</option>
                                        <option value="mile">mile</option>
                                    </select>
                                </div>
                                {selectedCategory.mileageRate && formData.distance && (
                                    <p className="text-xs text-muted-foreground">
                                        ≈ ৳{(parseFloat(formData.distance) * (formData.distanceUnit === "mile" ? 1.60934 : 1) * selectedCategory.mileageRate).toLocaleString("en-BD", { maximumFractionDigits: 2 })}
                                        {" "}(rate: ৳{selectedCategory.mileageRate}/km)
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">{t("expenseDateLabel")}</Label>
                                <Input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="bg-background border-card-border text-foreground"
                                />
                            </div>
                        </div>
                    )}

                    {/* Per-diem input */}
                    {selectedCategory?.categoryType === "per_diem" && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">Number of Days</Label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    value={formData.perDiemDays}
                                    onChange={(e) => setFormData({ ...formData, perDiemDays: e.target.value })}
                                    placeholder="1.0 (use 0.5 for half day)"
                                    className="bg-background border-card-border text-foreground"
                                />
                                {selectedCategory.perDiemRate && formData.perDiemDays && (
                                    <p className="text-xs text-muted-foreground">
                                        ≈ ৳{(parseFloat(formData.perDiemDays) * selectedCategory.perDiemRate).toLocaleString("en-BD", { maximumFractionDigits: 2 })}
                                        {" "}(rate: ৳{selectedCategory.perDiemRate}/day)
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">{t("expenseDateLabel")}</Label>
                                <Input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="bg-background border-card-border text-foreground"
                                />
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">{t("descriptionLabel")}</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            placeholder={t("descriptionPlaceholder")}
                            className="bg-background border-card-border text-foreground"
                        />
                    </div>

                    {/* Receipt Upload */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">
                            {selectedCategory?.requiresReceipt ? t("receiptRequired") : t("receiptOptional")}
                        </Label>
                        <div className="border-2 border-dashed border-card-border rounded-lg p-6 text-center hover:border-blue-500/50 transition-colors cursor-pointer">
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                id="receipt-upload"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        setFormData({ ...formData, receipt: e.target.files[0] });
                                    }
                                }}
                            />
                            <label htmlFor="receipt-upload" className="cursor-pointer">
                                <Upload className="h-8 w-8 text-muted-text mx-auto mb-2" />
                                {formData.receipt ? (
                                    <p className="text-sm text-green-400">{formData.receipt.name}</p>
                                ) : (
                                    <>
                                        <p className="text-sm text-muted-foreground">{t("receiptDragDrop")}</p>
                                        <p className="text-xs text-tertiary-foreground mt-1">{t("supportedFormats")}</p>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end">
                        <Link href="/ess/expenses">
                            <Button variant="outline" className="border-card-border">
                                {t("cancelBtn")}
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            className="border-card-border"
                            onClick={() => handleSubmit(true)}
                            disabled={isSubmitting}
                        >
                            {t("saveAsDraft")}
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-500"
                            onClick={() => handleSubmit(false)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t("submitting")}
                                </>
                            ) : (
                                t("submitForApproval")
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
