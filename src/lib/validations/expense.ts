/**
 * Expense Validation Schemas
 */
import * as z from "zod";

export const expenseClaimSchema = z.object({
    categoryId: z.string().min(1, "Category is required"),
    amount: z.coerce.number().min(0.01, "Amount must be positive"),
    currency: z.string().optional().default("BDT"),
    expenseDate: z.coerce.date(),
    description: z.string().min(5, "Description is required"),
    attachmentUrl: z.string().url().optional().or(z.literal("")),
});

export const expenseApprovalSchema = z.object({
    status: z.enum(["approved", "rejected"]),
    approverRemarks: z.string().optional(),
    approvedAmount: z.coerce.number().min(0).optional(),
});

export const expenseCategorySchema = z.object({
    name: z.string().min(1, "Category name is required"),
    nameBn: z.string().optional(),
    code: z.string().optional(),
    maxLimit: z.coerce.number().min(0).optional(),
    requiresReceipt: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
});

export type ExpenseClaimFormValues = z.infer<typeof expenseClaimSchema>;
export type ExpenseApprovalInput = z.infer<typeof expenseApprovalSchema>;
export type ExpenseCategoryFormValues = z.infer<typeof expenseCategorySchema>;
