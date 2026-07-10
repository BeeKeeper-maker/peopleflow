"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
    Receipt,
    Plus,
    Trash2,
    Calculator,
    Loader2,
    ArrowLeft,
    Upload,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════

interface ExpenseItem {
    id: string;
    category: string;
    description: string;
    amount: number;
    date: string;
}

interface Category {
    id: string;
    name: string;
}

// ════════════════════════════════════════════════════════════════════════
// New Expense Claim Form
// ════════════════════════════════════════════════════════════════════════

export default function NewExpenseClaimPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const t = useTranslations('ExpensesNew');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<ExpenseItem[]>([
        { id: crypto.randomUUID(), category: "", description: "", amount: 0, date: new Date().toISOString().split("T")[0] },
    ]);
    const [notes, setNotes] = useState("");

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await fetch("/api/expenses/categories");
            if (res.ok) {
                const data = await res.json();
                setCategories(data.categories || []);
            }
        } catch (error) {
            console.error("Failed to fetch categories:", error);
        } finally {
            setLoading(false);
        }
    };

    const addItem = () => {
        setItems([
            ...items,
            { id: crypto.randomUUID(), category: "", description: "", amount: 0, date: new Date().toISOString().split("T")[0] },
        ]);
    };

    const removeItem = (id: string) => {
        if (items.length <= 1) return;
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: keyof ExpenseItem, value: string | number) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const handleSubmit = async () => {
        // Validate
        for (const item of items) {
            if (!item.category || !item.description || !item.amount || !item.date) {
                addToast({ title: t("incomplete"), description: t("incompleteDesc"), type: "error" });
                return;
            }
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/expenses/claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: items.map(i => ({
                        category: i.category,
                        description: i.description,
                        amount: Number(i.amount),
                        date: i.date,
                    })),
                    notes,
                }),
            });

            if (res.ok) {
                addToast({ title: t("claimSubmitted"), description: t("claimSubmittedDesc"), type: "success" });
                router.push("/expenses");
            } else {
                const err = await res.json();
                addToast({ title: t("networkError"), description: err.error || t("submissionFailed"), type: "error" });
            }
        } catch {
            addToast({ title: t("networkError"), description: t("networkError"), type: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="space-y-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => router.push("/expenses")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">{t('title')}</h1>
                        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                    </div>
                </div>

                {/* Expense Items */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">{t("expenseItems")}</CardTitle>
                                <CardDescription>{t("addItemsHint")}</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
                                <Plus className="h-4 w-4" /> {t("addItem")}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={item.id} className="p-4 rounded-xl bg-hover border border-card-border space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">{t("itemNumber", { number: index + 1 })}</span>
                                        {items.length > 1 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                onClick={() => removeItem(item.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{t("categoryLabel")}</Label>
                                            {loading ? (
                                                <Skeleton className="h-10 w-full rounded-lg" />
                                            ) : (
                                                <select
                                                    value={item.category}
                                                    onChange={(e) => updateItem(item.id, "category", e.target.value)}
                                                    className="w-full h-10 px-3 rounded-lg bg-hover border border-card-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                >
                                                    <option value="">{t("selectCategory")}</option>
                                                    {categories.length > 0 ? (
                                                        categories.map(c => (
                                                            <option key={c.id} value={c.name}>{c.name}</option>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <option value="Travel">{t("categoryTravel")}</option>
                                                            <option value="Meals">{t("categoryMeals")}</option>
                                                            <option value="Office Supplies">{t("categoryOfficeSupplies")}</option>
                                                            <option value="Transportation">{t("categoryTransportation")}</option>
                                                            <option value="Training">{t("categoryTraining")}</option>
                                                            <option value="Other">{t("categoryOther")}</option>
                                                        </>
                                                    )}
                                                </select>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label>{t("dateLabel")}</Label>
                                            <Input
                                                type="date"
                                                value={item.date}
                                                onChange={(e) => updateItem(item.id, "date", e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2 sm:col-span-2">
                                            <Label>{t("descriptionLabel")}</Label>
                                            <Input
                                                value={item.description}
                                                onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                                placeholder={t("descriptionPlaceholder")}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>{t("amountLabel")}</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.amount || ""}
                                                onChange={(e) => updateItem(item.id, "amount", parseFloat(e.target.value) || 0)}
                                                placeholder={t("amountPlaceholder")}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">{t("additionalNotes")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full h-24 px-3 py-2 rounded-lg bg-hover border border-card-border text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder={t("notesPlaceholder")}
                        />
                    </CardContent>
                </Card>

                {/* Summary + Submit */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                    <Calculator className="h-6 w-6 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{t("totalAmount")}</p>
                                    <p className="text-2xl font-display font-bold tabular-nums text-foreground">৳{total.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <Button variant="outline" onClick={() => router.push("/expenses")} className="flex-1 sm:flex-none">
                                    {t("cancelBtn")}
                                </Button>
                                <Button onClick={handleSubmit} disabled={submitting} className="gap-2 flex-1 sm:flex-none">
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                                    {submitting ? t('submitting') : t('submitClaim')}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
