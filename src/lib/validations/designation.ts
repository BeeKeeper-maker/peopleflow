import * as z from "zod"

export const designationSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    nameBn: z.string().optional(),
    code: z.string().optional(),
    grade: z.coerce.number().min(1, "Grade must be a positive number").optional(),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
})

export type DesignationFormValues = z.infer<typeof designationSchema>
