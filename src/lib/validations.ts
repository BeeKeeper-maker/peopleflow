/**
 * Zod Validation Schemas for API Endpoints
 * Centralized validation for all request bodies
 */

import { z } from "zod";

// ============================================
// Common Schemas
// ============================================

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const idParamSchema = z.object({
    id: z.string().min(1, "ID is required"),
});

export const dateRangeSchema = z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
}).refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
});

// ============================================
// Auth Schemas
// ============================================

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    organizationName: z.string().min(2, "Organization name is required").optional(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

// ============================================
// Employee Schemas
// ============================================

export const createEmployeeSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    employeeCode: z.string().optional(),
    dateOfBirth: z.coerce.date().optional(),
    joiningDate: z.coerce.date(),
    departmentId: z.string().min(1, "Department is required"),
    designationId: z.string().min(1, "Designation is required"),
    shiftId: z.string().optional(),
    reportingToId: z.string().optional(),
    employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
    gender: z.enum(["male", "female", "other"]).optional(),
    maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
    nationality: z.string().optional(),
    nidNumber: z.string().optional(),
    passportNumber: z.string().optional(),

    // Address
    presentAddress: z.string().optional(),
    permanentAddress: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),

    // Emergency Contact
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    emergencyContactRelation: z.string().optional(),

    // Bank Details
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankBranch: z.string().optional(),
    bankRoutingNumber: z.string().optional(),

    // Create user account
    createUserAccount: z.boolean().optional().default(false),
    role: z.enum(["ADMIN", "HR_MANAGER", "MANAGER", "EMPLOYEE"]).optional().default("EMPLOYEE"),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

// ============================================
// Department Schemas
// ============================================

export const createDepartmentSchema = z.object({
    name: z.string().min(1, "Department name is required"),
    nameBn: z.string().optional(),
    code: z.string().optional(),
    description: z.string().optional(),
    headId: z.string().optional(),
    parentId: z.string().optional(),
    isActive: z.boolean().optional().default(true),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

// ============================================
// Designation Schemas
// ============================================

export const createDesignationSchema = z.object({
    name: z.string().min(1, "Designation name is required"),
    nameBn: z.string().optional(),
    code: z.string().optional(),
    grade: z.coerce.number().int().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional().default(true),
});

export const updateDesignationSchema = createDesignationSchema.partial();

// ============================================
// Leave Schemas
// ============================================

export const createLeaveTypeSchema = z.object({
    name: z.string().min(1, "Leave type name is required"),
    nameBn: z.string().optional(),
    code: z.string().optional(),
    defaultDays: z.coerce.number().int().min(0).default(0),
    maxCarryForward: z.coerce.number().int().min(0).optional(),
    isPaid: z.boolean().optional().default(true),
    requiresApproval: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

export const createLeaveApplicationSchema = z.object({
    leaveTypeId: z.string().min(1, "Leave type is required"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().min(10, "Reason must be at least 10 characters"),
    isHalfDay: z.boolean().optional().default(false),
    halfDayType: z.enum(["first_half", "second_half"]).optional(),
}).refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
});

export const updateLeaveApplicationSchema = z.object({
    status: z.enum(["approved", "rejected"]),
    approverRemarks: z.string().optional(),
});

// ============================================
// Attendance Schemas
// ============================================

export const checkInSchema = z.object({
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    notes: z.string().optional(),
});

export const checkOutSchema = z.object({
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    notes: z.string().optional(),
});

export const manualAttendanceSchema = z.object({
    employeeId: z.string().min(1, "Employee is required"),
    date: z.coerce.date(),
    checkIn: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
    checkOut: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)").optional(),
    status: z.enum(["present", "absent", "late", "half_day", "on_leave"]),
    notes: z.string().optional(),
});

// ============================================
// Payroll Schemas
// ============================================

export const createPayrollStructureSchema = z.object({
    name: z.string().min(1, "Structure name is required"),
    basicSalary: z.coerce.number().min(0, "Basic salary must be positive"),

    // Allowances
    houseRentAllowance: z.coerce.number().min(0).optional().default(0),
    medicalAllowance: z.coerce.number().min(0).optional().default(0),
    transportAllowance: z.coerce.number().min(0).optional().default(0),
    foodAllowance: z.coerce.number().min(0).optional().default(0),
    otherAllowances: z.coerce.number().min(0).optional().default(0),

    // Deductions
    providentFund: z.coerce.number().min(0).optional().default(0),
    professionalTax: z.coerce.number().min(0).optional().default(0),
    incomeTax: z.coerce.number().min(0).optional().default(0),
    otherDeductions: z.coerce.number().min(0).optional().default(0),

    isActive: z.boolean().optional().default(true),
});

export const updatePayrollStructureSchema = createPayrollStructureSchema.partial();

export const processPayrollSchema = z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2020).max(2100),
    employeeIds: z.array(z.string()).optional(),
    processAll: z.boolean().optional().default(false),
}).refine((data) => data.processAll || (data.employeeIds && data.employeeIds.length > 0), {
    message: "Either processAll must be true or employeeIds must be provided",
    path: ["employeeIds"],
});

// ============================================
// Shift Schemas
// ============================================

export const createShiftSchema = z.object({
    name: z.string().min(1, "Shift name is required"),
    nameBn: z.string().optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
    graceMinutes: z.coerce.number().int().min(0).optional().default(15),
    isOvernight: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
});

export const updateShiftSchema = createShiftSchema.partial();

// ============================================
// Expense Schemas
// ============================================

export const createExpenseClaimSchema = z.object({
    categoryId: z.string().min(1, "Category is required"),
    amount: z.coerce.number().min(0.01, "Amount must be positive"),
    currency: z.string().optional().default("BDT"),
    expenseDate: z.coerce.date(),
    description: z.string().min(5, "Description is required"),
    attachmentUrl: z.string().url().optional(),
});

export const updateExpenseClaimSchema = z.object({
    status: z.enum(["approved", "rejected"]),
    approverRemarks: z.string().optional(),
    approvedAmount: z.coerce.number().min(0).optional(),
});

// ============================================
// Performance/Goals Schemas
// ============================================

export const createGoalSchema = z.object({
    title: z.string().min(1, "Goal title is required"),
    description: z.string().optional(),
    targetDate: z.coerce.date(),
    priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
    category: z.string().optional(),
    targetValue: z.coerce.number().optional(),
    unit: z.string().optional(),
});

export const updateGoalSchema = createGoalSchema.partial().extend({
    progress: z.coerce.number().min(0).max(100).optional(),
    status: z.enum(["not_started", "in_progress", "completed", "cancelled"]).optional(),
    currentValue: z.coerce.number().optional(),
});

// ============================================
// Recruitment Schemas
// ============================================

export const createJobPostingSchema = z.object({
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
});

export const updateJobPostingSchema = createJobPostingSchema.partial();

// ============================================
// Notification Schema
// ============================================

export const markNotificationsReadSchema = z.object({
    notificationIds: z.array(z.string()).optional(),
    markAll: z.boolean().optional().default(false),
}).refine((data) => data.markAll || (data.notificationIds && data.notificationIds.length > 0), {
    message: "Either markAll must be true or notificationIds must be provided",
    path: ["notificationIds"],
});

// ============================================
// Report Schemas
// ============================================

export const attendanceReportSchema = z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    departmentId: z.string().optional(),
    employeeId: z.string().optional(),
    format: z.enum(["json", "csv", "excel"]).optional().default("json"),
}).refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
});

// ============================================
// Type Exports
// ============================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type CreateLeaveApplicationInput = z.infer<typeof createLeaveApplicationSchema>;
export type CreatePayrollStructureInput = z.infer<typeof createPayrollStructureSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;
