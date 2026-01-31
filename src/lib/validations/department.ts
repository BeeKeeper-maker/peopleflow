import * as z from "zod"

export const departmentSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    nameBn: z.string().optional(),
    code: z.string().optional(),
    description: z.string().optional(),
    parentId: z.string().optional(),
    managerId: z.string().optional(),
    isActive: z.boolean().default(true),
})

export type DepartmentFormValues = z.infer<typeof departmentSchema>
