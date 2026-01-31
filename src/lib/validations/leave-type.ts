import * as z from "zod"

export const leaveTypeSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    nameBn: z.string().optional(),
    code: z.string().min(2, "Code must be at least 2 characters"),
    description: z.string().optional(),
    color: z.string().optional(),

    // Allocation
    annualAllocation: z.coerce.number().min(0),
    maxAccumulation: z.coerce.number().optional(),
    carryForwardLimit: z.coerce.number().optional(),

    // Eligibility
    applicableGender: z.enum(["male", "female", "all"]).default("all"),
    minServiceDays: z.coerce.number().optional(),
    requiresDocument: z.boolean().default(false),

    // Encashment
    encashmentAllowed: z.boolean().default(false),
    proRataEnabled: z.boolean().default(true),

    isActive: z.boolean().default(true),
})

export type LeaveTypeFormValues = z.infer<typeof leaveTypeSchema>
