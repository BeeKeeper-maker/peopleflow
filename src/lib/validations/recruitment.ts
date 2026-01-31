/**
 * Recruitment / Job Posting Validation Schemas
 */
import * as z from "zod";

export const jobPostingSchema = z.object({
    title: z.string().min(1, "Job title is required"),
    description: z.string().min(20, "Job description must be at least 20 characters"),
    requirements: z.string().optional(),
    responsibilities: z.string().optional(),
    departmentId: z.string().optional(),
    designationId: z.string().optional(),
    employmentType: z.enum(["full_time", "part_time", "contract", "internship"]),
    experience: z.string().optional(),
    education: z.string().optional(),
    skills: z.string().optional(),
    salaryMin: z.coerce.number().min(0).optional(),
    salaryMax: z.coerce.number().min(0).optional(),
    showSalary: z.boolean().optional().default(false),
    location: z.string().optional(),
    isRemote: z.boolean().optional().default(false),
    vacancies: z.coerce.number().int().min(1).optional().default(1),
    deadline: z.coerce.date().optional(),
    status: z.enum(["draft", "published", "closed"]).optional().default("draft"),
}).refine((data) => {
    if (data.salaryMin && data.salaryMax) {
        return data.salaryMin <= data.salaryMax;
    }
    return true;
}, {
    message: "Minimum salary must be less than or equal to maximum salary",
    path: ["salaryMin"],
});

export type JobPostingFormValues = z.infer<typeof jobPostingSchema>;
