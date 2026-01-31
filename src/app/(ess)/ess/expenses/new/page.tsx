"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

interface ExpenseCategory {
    id: string;
    name: string;
    maxAmount?: number;
    monthlyLimit?: number;
    requiresReceipt: boolean;
    color?: string;
}

export default function NewExpenseClaimPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        amount: "",
        categoryId: "",
        expenseDate: new Date().toISOString().split("T")[0],
        receiptUrl: "",
        receiptName: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch("/api/expenses/categories?active=true");
                if (response.ok) {
                    const data = await response.json();
                    setCategories(data);
                }
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };
        fetchCategories();
    }, []);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.title.trim()) {
            newErrors.title = "Title is required";
        }
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            newErrors.amount = "Valid amount is required";
        }
        if (!formData.categoryId) {
            newErrors.categoryId = "Category is required";
        }
        if (!formData.expenseDate) {
            newErrors.expenseDate = "Expense date is required";
        }

        // Check max amount
        if (selectedCategory?.maxAmount && parseFloat(formData.amount) > selectedCategory.maxAmount) {
            newErrors.amount = `Amount exceeds maximum of ৳${selectedCategory.maxAmount.toLocaleString()}`;
        }

        // Check if receipt required
        if (selectedCategory?.requiresReceipt && !formData.receiptUrl) {
            newErrors.receiptUrl = "Receipt is required for this category";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent, asDraft: boolean = false) => {
        e.preventDefault();

        if (!asDraft && !validate()) return;

        setIsLoading(true);

        try {
            const response = await fetch("/api/expenses/claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    amount: parseFloat(formData.amount),
                    status: asDraft ? "draft" : "submitted",
                }),
            });

            if (response.ok) {
                setIsSubmitted(true);
            } else {
                const data = await response.json();
                console.error("Error:", data.error);
            }
        } catch (error) {
            console.error("Error submitting claim:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCategoryChange = (categoryId: string) => {
        setFormData({ ...formData, categoryId });
        const category = categories.find((c) => c.id === categoryId);
        setSelectedCategory(category || null);
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
                            Expense Claim Submitted!
                        </h2>
                        <p className="text-white/60 mb-6">
                            Your expense claim has been submitted for approval. You'll be notified
                            once your manager reviews it.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Link href="/ess/expenses">
                                <Button
                                    variant="outline"
                                    className="border-white/10 text-white/60 hover:text-white"
                                >
                                    View My Expenses
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
                <Link href="/ess/expenses">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/60 hover:text-white hover:bg-white/5"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">New Expense Claim</h1>
                    <p className="text-white/60 mt-1">
                        Submit a new expense for reimbursement
                    </p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={(e) => handleSubmit(e, false)}>
                <Card className="bg-[#141419] border-white/5">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-blue-400" />
                            Expense Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Category */}
                        <div className="space-y-2">
                            <Label className="text-white">Category *</Label>
                            <Select
                                value={formData.categoryId}
                                onValueChange={handleCategoryChange}
                            >
                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="Select expense category" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A1A1F] border-white/10">
                                    {categories.map((category) => (
                                        <SelectItem
                                            key={category.id}
                                            value={category.id}
                                            className="text-white hover:bg-white/10"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: category.color || "#6366f1" }}
                                                />
                                                <span>{category.name}</span>
                                                {category.maxAmount && (
                                                    <span className="text-xs text-white/40">
                                                        (max ৳{category.maxAmount.toLocaleString()})
                                                    </span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.categoryId && (
                                <p className="text-sm text-red-400">{errors.categoryId}</p>
                            )}
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <Label className="text-white">Title *</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g., Uber to client meeting"
                                className="bg-white/5 border-white/10 text-white"
                            />
                            {errors.title && (
                                <p className="text-sm text-red-400">{errors.title}</p>
                            )}
                        </div>

                        {/* Amount and Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-white">Amount (BDT) *</Label>
                                <Input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="bg-white/5 border-white/10 text-white"
                                />
                                {errors.amount && (
                                    <p className="text-sm text-red-400">{errors.amount}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white">Expense Date *</Label>
                                <div className="relative">
                                    <Input
                                        type="date"
                                        value={formData.expenseDate}
                                        onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                                        className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
                                    />
                                </div>
                                {errors.expenseDate && (
                                    <p className="text-sm text-red-400">{errors.expenseDate}</p>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label className="text-white">Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Provide additional details about this expense..."
                                className="bg-white/5 border-white/10 text-white min-h-[80px]"
                            />
                        </div>

                        {/* Receipt Upload */}
                        <div className="space-y-2">
                            <Label className="text-white">
                                Receipt {selectedCategory?.requiresReceipt ? "*" : "(Optional)"}
                            </Label>
                            <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:border-white/20 transition-colors">
                                <Upload className="h-8 w-8 text-white/40 mx-auto mb-2" />
                                <p className="text-white/60 text-sm mb-2">
                                    Drag and drop your receipt here, or click to browse
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 text-white/60 hover:text-white"
                                >
                                    Upload Receipt
                                </Button>
                                <p className="text-white/40 text-xs mt-2">
                                    Supported formats: JPG, PNG, PDF (max 5MB)
                                </p>
                            </div>
                            {errors.receiptUrl && (
                                <p className="text-sm text-red-400">{errors.receiptUrl}</p>
                            )}
                        </div>

                        {/* Selected Category Limits Info */}
                        {selectedCategory && (
                            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <h4 className="text-blue-400 font-medium mb-2">Category Limits</h4>
                                <div className="text-sm text-white/60 space-y-1">
                                    {selectedCategory.maxAmount && (
                                        <p>Maximum per claim: ৳{selectedCategory.maxAmount.toLocaleString()}</p>
                                    )}
                                    {selectedCategory.monthlyLimit && (
                                        <p>Monthly limit: ৳{selectedCategory.monthlyLimit.toLocaleString()}</p>
                                    )}
                                    {selectedCategory.requiresReceipt && (
                                        <p>Receipt required for this category</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Submit */}
                        <div className="flex items-center justify-end gap-4 pt-4">
                            <Link href="/ess/expenses">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-white/10 text-white/60 hover:text-white"
                                >
                                    Cancel
                                </Button>
                            </Link>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={(e) => handleSubmit(e, true)}
                                disabled={isLoading}
                                className="border-white/10 text-white/60 hover:text-white"
                            >
                                Save as Draft
                            </Button>
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
                                    "Submit for Approval"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
