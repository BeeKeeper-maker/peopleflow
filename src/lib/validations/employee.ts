import * as z from "zod";

export const employeeSchema = z.object({
    // Personal Information
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),

    // Allow string or Date, transform to Date object (or Date -> Date)
    // Input from form will be string (YYYY-MM-DD)
    dateOfBirth: z.union([z.string(), z.date()]).optional().transform((val) => {
        if (!val) return undefined;
        return new Date(val);
    }),

    gender: z.enum(["male", "female", "other"]).optional(),
    maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
    nationality: z.string().default("Bangladeshi"),
    nidNumber: z.string().optional(),
    photoUrl: z.string().optional(),

    // Employment Details
    employeeCode: z.string().min(1, "Employee code is required"),
    departmentId: z.string().min(1, "Department is required"),
    designationId: z.string().min(1, "Designation is required"),

    joiningDate: z.union([z.string(), z.date()]).transform((val) => new Date(val)),

    employmentType: z.enum(["permanent", "contractual", "intern", "probation"]),
    employmentStatus: z.enum(["active", "resigned", "terminated", "retired"]).default("active"),
    reportingManagerId: z.string().optional(),
    shiftId: z.string().optional(),
    pfEnabled: z.boolean().default(true),

    // Financial Information
    grossSalary: z.coerce.number().min(0, "Gross salary must be positive"),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;
export type EmployeeFormInput = z.input<typeof employeeSchema>;
