import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// PeopleFlow — SINGLE SOURCE OF TRUTH: Employee Validation Schema
// ─────────────────────────────────────────────────────────────────────────────
// Shared by BOTH client (react-hook-form zodResolver) and server (API routes).
// z.preprocess() sanitizes HTML form empty strings ("") → undefined, preventing
// Zod enum/date crashes (CRIT-01 through CRIT-06) without any client hacks.
// ─────────────────────────────────────────────────────────────────────────────

/** Sanitize empty strings and null to undefined so optional validators pass */
const sanitize = (val: unknown): unknown =>
    val === "" || val === null ? undefined : val;

/** Convert string/Date → Date, or undefined if empty/invalid */
const toDateOrUndefined = (val: unknown): Date | undefined => {
    if (!val || val === "") return undefined;
    if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
    const d = new Date(val as string);
    return isNaN(d.getTime()) ? undefined : d;
};

/** Convert string/Date → Date (required). Returns undefined for empty → Zod required will catch it */
const toDateRequired = (val: unknown): Date | undefined => {
    if (!val || val === "") return undefined;
    if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
    const d = new Date(val as string);
    return isNaN(d.getTime()) ? undefined : d;
};

// ─── Enum Constants (exported for UI <Select> rendering) ────────────────────

export const GENDER_OPTIONS = ["male", "female", "other"] as const;
export const MARITAL_STATUS_OPTIONS = ["single", "married", "divorced", "widowed"] as const;
export const EMPLOYMENT_TYPE_OPTIONS = ["permanent", "contractual", "intern", "probation"] as const;
export const EMPLOYMENT_STATUS_OPTIONS = ["active", "resigned", "terminated", "retired"] as const;
export const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

// ─── The Schema ─────────────────────────────────────────────────────────────

export const employeeSchema = z.object({
    // ── Personal Information ────────────────────────────────────────────────
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    bengaliName: z.preprocess(sanitize, z.string().optional()),
    email: z.preprocess(sanitize, z.string().email("Invalid email address").optional()),
    phone: z.preprocess(sanitize, z.string().optional().refine(
        (val) => !val || /^(\+?880|0)?1[3-9]\d{8}$/.test(val.replace(/[\s-]/g, "")),
        "Phone must be a valid Bangladesh number (e.g., 01712345678 or +8801712345678)"
    )),
    dateOfBirth: z.preprocess(toDateOrUndefined, z.date().optional()),
    gender: z.preprocess(sanitize, z.enum(GENDER_OPTIONS).optional()),
    bloodGroup: z.preprocess(sanitize, z.enum(BLOOD_GROUP_OPTIONS).optional()),
    maritalStatus: z.preprocess(sanitize, z.enum(MARITAL_STATUS_OPTIONS).optional()),
    nationality: z.preprocess(sanitize, z.string().default("Bangladeshi")),
    nidNumber: z.preprocess(sanitize, z.string().optional().refine(
        (val) => !val || /^\d{10}$|^\d{13}$|^\d{17}$/.test(val.replace(/\s/g, "")),
        "NID must be 10, 13, or 17 digits (Bangladesh NID format)"
    )),
    passportNumber: z.preprocess(sanitize, z.string().optional()),
    photoUrl: z.preprocess(
        sanitize,
        z.string()
            .optional()
            .refine((value) => !value || value.startsWith("/api/uploads/"), {
                message: "Profile photo must be uploaded through PeopleFlow",
            })
    ),

    // ── Employment Details ──────────────────────────────────────────────────
    employeeCode: z.string().min(1, "Employee code is required"),
    departmentId: z.string().min(1, "Department is required"),
    designationId: z.string().min(1, "Designation is required"),
    joiningDate: z.preprocess(
        toDateRequired,
        z.date({ error: "Joining date is required" })
    ),
    employmentType: z.preprocess(
        sanitize,
        z.enum(EMPLOYMENT_TYPE_OPTIONS).default("permanent")
    ),
    employmentStatus: z.preprocess(
        sanitize,
        z.enum(EMPLOYMENT_STATUS_OPTIONS).default("active")
    ),
    reportingManagerId: z.preprocess(sanitize, z.string().optional()),
    shiftId: z.preprocess(sanitize, z.string().optional()),
    biometricUserId: z.preprocess(sanitize, z.string().optional()),
    pfEnabled: z.boolean().default(true),

    // ── Financial Information ────────────────────────────────────────────────
    grossSalary: z.coerce.number().min(0, "Gross salary must be a positive number"),
    salaryStructureId: z.preprocess(sanitize, z.string().optional()),
    bankName: z.preprocess(sanitize, z.string().optional()),
    bankAccount: z.preprocess(sanitize, z.string().optional()),
    bankBranch: z.preprocess(sanitize, z.string().optional()),
    routingNumber: z.preprocess(sanitize, z.string().optional()),
    tinNumber: z.preprocess(sanitize, z.string().optional()),
    pfNumber: z.preprocess(sanitize, z.string().optional()),

    // ── Address & Emergency ─────────────────────────────────────────────────
    presentAddress: z.preprocess(sanitize, z.string().optional()),
    permanentAddress: z.preprocess(sanitize, z.string().optional()),
    emergencyContact: z.preprocess(sanitize, z.string().optional()),

    // Form wizard convenience fields (assembled into emergencyContact JSON)
    emergencyContactName: z.preprocess(sanitize, z.string().optional()),
    emergencyContactPhone: z.preprocess(sanitize, z.string().optional()),
    emergencyContactRelation: z.preprocess(sanitize, z.string().optional()),
});

// ─── Types ──────────────────────────────────────────────────────────────────

/** Output type after Zod parsing (dates are Date objects, enums are typed) */
export type EmployeeData = z.output<typeof employeeSchema>;

/**
 * Explicit form input type for react-hook-form.
 * All optional string fields are "" (HTML input default), dates are string
 * (YYYY-MM-DD from HTML date inputs). z.preprocess handles conversion.
 */
export interface EmployeeFormValues {
    firstName: string;
    lastName: string;
    bengaliName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup: string;
    maritalStatus: string;
    nationality: string;
    nidNumber: string;
    passportNumber: string;
    photoUrl: string;

    employeeCode: string;
    departmentId: string;
    designationId: string;
    joiningDate: string;
    employmentType: string;
    employmentStatus: string;
    reportingManagerId: string;
    shiftId: string;
    biometricUserId: string;
    pfEnabled: boolean;

    grossSalary: number;
    salaryStructureId: string;
    bankName: string;
    bankAccount: string;
    bankBranch: string;
    routingNumber: string;
    tinNumber: string;
    pfNumber: string;

    presentAddress: string;
    permanentAddress: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelation: string;
}

// ─── Default Values ─────────────────────────────────────────────────────────

export const DEFAULT_EMPLOYEE_VALUES: EmployeeFormValues = {
    firstName: "",
    lastName: "",
    bengaliName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
    maritalStatus: "",
    nationality: "Bangladeshi",
    nidNumber: "",
    passportNumber: "",
    photoUrl: "",

    employeeCode: "",
    departmentId: "",
    designationId: "",
    joiningDate: "",
    employmentType: "permanent",
    employmentStatus: "active",
    reportingManagerId: "",
    shiftId: "",
    biometricUserId: "",
    pfEnabled: true,

    grossSalary: 0,
    salaryStructureId: "",
    bankName: "",
    bankAccount: "",
    bankBranch: "",
    routingNumber: "",
    tinNumber: "",
    pfNumber: "",

    presentAddress: "",
    permanentAddress: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
};

// ─── Prisma Data Mapper ─────────────────────────────────────────────────────

/**
 * Converts parsed EmployeeData → Prisma-safe column object.
 * - Strips non-Prisma fields (grossSalary, salaryStructureId, bankAccount alias, emergency sub-fields)
 * - Maps bankAccount → accountNumber
 * - Converts undefined → null for nullable Prisma columns
 *
 * This replaces all `as any` spreads and prevents unknown-field Prisma crashes.
 */
export function toPrismaEmployeeData(data: EmployeeData) {
    return {
        firstName: data.firstName,
        lastName: data.lastName,
        bengaliName: data.bengaliName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        gender: data.gender ?? null,
        bloodGroup: data.bloodGroup ?? null,
        maritalStatus: data.maritalStatus ?? null,
        nationality: data.nationality,
        nidNumber: data.nidNumber ?? null,
        passportNumber: data.passportNumber ?? null,
        photoUrl: data.photoUrl ?? null,

        employeeCode: data.employeeCode,
        departmentId: data.departmentId,
        designationId: data.designationId,
        joiningDate: data.joiningDate,
        employmentType: data.employmentType,
        employmentStatus: data.employmentStatus,
        reportingManagerId: data.reportingManagerId ?? null,
        shiftId: data.shiftId ?? null,
        biometricUserId: data.biometricUserId ?? null,
        pfEnabled: data.pfEnabled,

        bankName: data.bankName ?? null,
        bankBranch: data.bankBranch ?? null,
        accountNumber: data.bankAccount ?? null, // Form field "bankAccount" → Prisma "accountNumber"
        routingNumber: data.routingNumber ?? null,
        tinNumber: data.tinNumber ?? null,
        pfNumber: data.pfNumber ?? null,

        presentAddress: data.presentAddress ?? null,
        permanentAddress: data.permanentAddress ?? null,
        // emergencyContact is set separately by the caller (assembled from sub-fields)
    };
}

/**
 * Builds emergencyContact JSON string from form sub-fields.
 */
export function buildEmergencyContactJson(data: EmployeeData): string | null {
    if (!data.emergencyContactName) return null;
    return JSON.stringify({
        name: data.emergencyContactName,
        phone: data.emergencyContactPhone ?? "",
        relationship: data.emergencyContactRelation ?? "",
    });
}
