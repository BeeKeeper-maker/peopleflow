import * as z from "zod";

export const employeeSchema = z.object({
    // Personal Information
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
    bengaliName: z.string().optional(),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    phone: z.string().optional(),

    // Allow string or Date, transform to Date object
    dateOfBirth: z.union([z.string(), z.date()]).optional().transform((val) => {
        if (!val) return undefined;
        return new Date(val);
    }),

    gender: z.enum(["male", "female", "other"]).optional(),
    bloodGroup: z.string().optional(),
    maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
    nationality: z.string().default("Bangladeshi"),
    nidNumber: z.string().optional(),
    passportNumber: z.string().optional(),
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
    biometricUserId: z.string().optional(), // Maps to biometric device user ID
    pfEnabled: z.boolean().default(true),

    // Financial Information
    grossSalary: z.coerce.number().min(0, "Gross salary must be positive"),
    salaryStructureId: z.string().optional(),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
    bankBranch: z.string().optional(),
    routingNumber: z.string().optional(),
    tinNumber: z.string().optional(),
    pfNumber: z.string().optional(),

    // Address & Emergency
    presentAddress: z.string().optional(),
    permanentAddress: z.string().optional(),
    emergencyContact: z.string().optional(), // JSON string: {name, phone, relationship}

    // Separate emergency contact fields (used by form wizard)
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    emergencyContactRelation: z.string().optional(),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;
export type EmployeeFormInput = z.input<typeof employeeSchema>;
