/**
 * Payroll / Salary Structure Validation Schemas
 */
import * as z from "zod";

export const salaryStructureSchema = z.object({
    name: z.string().min(1, "Name is required"),
    basicPercentage: z.coerce.number().min(0).max(100),
    houseRentPercent: z.coerce.number().min(0).max(100),
    medicalPercent: z.coerce.number().min(0).max(100),
    conveyanceFixed: z.coerce.number().min(0),
    pfEmployeePercent: z.coerce.number().min(0).max(100),
    pfEmployerPercent: z.coerce.number().min(0).max(100),
    description: z.string().optional(),
    isActive: z.boolean().optional().default(true),
});

export const processPayrollSchema = z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2020).max(2100),
    employeeIds: z.array(z.string()).optional(),
    processAll: z.boolean().optional().default(false),
}).refine((data) => data.processAll || (data.employeeIds && data.employeeIds.length > 0), {
    message: "Either processAll must be true or employeeIds must be provided",
    path: ["employeeIds"],
});

export const payrollAssignmentSchema = z.object({
    employeeId: z.string().min(1, "Employee is required"),
    salaryStructureId: z.string().min(1, "Salary structure is required"),
    grossSalary: z.coerce.number().min(0, "Gross salary must be positive"),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional(),
});

export type SalaryStructureFormValues = z.infer<typeof salaryStructureSchema>;
export type ProcessPayrollInput = z.infer<typeof processPayrollSchema>;
export type PayrollAssignmentInput = z.infer<typeof payrollAssignmentSchema>;
