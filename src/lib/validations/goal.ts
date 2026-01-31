/**
 * Goal Validation Schemas
 */
import * as z from "zod";

const keyResultSchema = z.object({
    title: z.string().min(1, "Key result title is required"),
    targetValue: z.coerce.number().default(100),
    unit: z.string().default("%"),
});

export const createGoalSchema = z.object({
    title: z.string().min(1, "Goal title is required"),
    description: z.string().optional(),
    type: z.enum(["individual", "team", "company"]).default("individual"),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    startDate: z.string().optional().transform((val) => {
        if (!val || val.trim() === "") return null;
        return new Date(val);
    }),
    dueDate: z.string().optional().transform((val) => {
        if (!val || val.trim() === "") return null;
        return new Date(val);
    }),
    employeeId: z.string().optional(),
    reviewCycleId: z.string().optional(),
    keyResults: z.array(keyResultSchema).optional(),
});

export const updateGoalSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
    status: z.enum(["not_started", "in_progress", "completed", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueDate: z.string().optional().transform((val) => {
        if (!val || val.trim() === "") return undefined;
        return new Date(val);
    }),
});

export type CreateGoalFormValues = z.infer<typeof createGoalSchema>;
export type UpdateGoalFormValues = z.infer<typeof updateGoalSchema>;
