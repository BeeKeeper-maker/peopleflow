import * as z from "zod"

export const leaveApplicationSchema = z.object({
    leaveTypeId: z.string().min(1, "Leave type is required"),
    fromDate: z.date({ message: "Start date is required" }),
    toDate: z.date({ message: "End date is required" }),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    halfDay: z.boolean().default(false),
    halfDayType: z.enum(["first_half", "second_half"]).optional(),
    documents: z.array(z.string()).optional(), // Array of file URLs
})

export type LeaveApplicationFormValues = z.infer<typeof leaveApplicationSchema>

