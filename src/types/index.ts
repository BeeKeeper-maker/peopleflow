// Core types for PeopleFlow HRMS

export type Role = "super_admin" | "admin" | "hr_admin" | "manager" | "employee";

export type EmploymentType = "permanent" | "contractual" | "intern" | "probation";

export type EmploymentStatus = "active" | "resigned" | "terminated" | "retired" | "on_leave";

export type Gender = "male" | "female" | "other";

export type MaritalStatus = "single" | "married" | "divorced" | "widowed";

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type AttendanceStatus = "present" | "absent" | "half_day" | "on_leave" | "holiday" | "weekend";

export type LoanStatus = "pending" | "approved" | "rejected" | "disbursed" | "closed";

export type SalaryStatus = "draft" | "approved" | "paid";

export type AnnouncementType = "general" | "policy" | "celebration" | "urgent";

export type NotificationType =
    | "leave_approval"
    | "leave_rejected"
    | "leave_request"
    | "payroll"
    | "announcement"
    | "reminder"
    | "birthday"
    | "loan_approval"
    | "attendance";

export interface Address {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
}

export interface EmergencyContact {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
}

export interface GeoLocation {
    lat: number;
    lng: number;
    address?: string;
}

// Bangladesh Tax Categories
export type TaxCategory = "male" | "female" | "senior" | "disabled" | "war_wounded";

// Pagination
export interface PaginationParams {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// API Response
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// Dashboard Stats
export interface DashboardStats {
    totalEmployees: number;
    presentToday: number;
    onLeave: number;
    pendingLeaveRequests: number;
    pendingLoanRequests: number;
    newHiresThisMonth: number;
    attritionRate: number;
    avgTenure: number;
}

// Menu Item for Navigation
export interface MenuItem {
    label: string;
    labelBn?: string;
    href: string;
    icon?: string;
    badge?: number;
    children?: MenuItem[];
    roles?: Role[];
}

// Filter Options
export interface FilterOption {
    value: string;
    label: string;
    labelBn?: string;
}

// Chart Data
export interface ChartDataPoint {
    name: string;
    value: number;
    color?: string;
}

export interface TimeSeriesData {
    date: string;
    value: number;
}
