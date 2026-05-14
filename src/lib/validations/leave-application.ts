import * as z from "zod"

export const leaveApplicationSchema = z.object({
    leaveTypeId: z.string().min(1, "Leave type is required"),
    fromDate: z.date({ message: "Start date is required" }),
    toDate: z.date({ message: "End date is required" }),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    halfDay: z.boolean().default(false),
    halfDayType: z.enum(["first_half", "second_half"]).optional(),
    documents: z.array(z.string()).optional(), // Array of file URLs
}).superRefine((data, ctx) => {
    if (data.toDate < data.fromDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["toDate"],
            message: "End date cannot be before start date",
        })
    }

    if (data.halfDay) {
        if (!data.halfDayType) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["halfDayType"],
                message: "Select first half or second half",
            })
        }

        if (data.fromDate.toDateString() !== data.toDate.toDateString()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["toDate"],
                message: "Half-day leave must start and end on the same date",
            })
        }
    }
})

export type LeaveApplicationFormValues = z.infer<typeof leaveApplicationSchema>
